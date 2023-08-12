const express = require('express');
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const { log } = require('console');

const app = express()
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
mongoose.connect("mongodb://127.0.0.1:27017/billingDB?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+1.9.1")

const transactionSchema = new mongoose.Schema({
  transaction_amount: Number,
  transaction_type: {
    type: String,
    enum: ['credit', 'debit']
  },
  transaction_date: {
    type: String,
    default: new Date().toLocaleDateString("en-gb")
  },
  transaction_time: { type: String, default: new Date().toLocaleTimeString() },
  transaction_balance: { type: Number, default: 0 },
  remarks: { type: String }
});

const customerSchema = new mongoose.Schema({
  customerId: { type: Number, unique: true },
  customerName: {
    type: String,
    unique: true
  },
  mobile_no: {
    type: String,
    unique: true
  },
  balance: {
    type: Number,
    default: 0
  },
  transactions: { type: [transactionSchema], default: [] }
})


function parseDate(dateString) {
  const [day, month, year] = dateString.split("/");
  return new Date(`${year} ${month} ${day}`);
}


customerSchema.pre('save', async function (next) {// Incremental customerId
  if (!this.customerId) {
    try {
      const count = await this.constructor.countDocuments();
      this.customerId = count + 1;
    } catch (error) {
      console.error(error);
      throw new Error('Error generating customer ID');
    }
  }
  const latestTransaction = this.transactions[this.transactions.length - 1];
  if (latestTransaction) {
    latestTransaction.transaction_balance = this.balance;
  }
  next();
});

const Customer = mongoose.model("customer", customerSchema)


app.route("/")
  .get((req, res) => { //landing page
    Customer.find({}).then(function (customers) {
      res.render("allCustomers", {
        customers: customers,
      });
    })
      .catch(function (err) {
        console.log(err);
      })
  })
  .post(function (req, res) { //search
    const customerName = req.body.customerName;
    Customer.findOne({ customerName })
      .exec()
      .then(function (foundCustomer) {
        if (foundCustomer) {
          res.send(foundCustomer);
        } else {
          res.send('<script>alert("Customer not found");window.location.href = "/";</script>');
        }
      })
      .catch(function (err) {
        console.log(err);
        res.status(500).send('Error searching for customer');
      });
  })


app.route("/addCustomer")
  .get(function (req, res) {
    res.render("addCustomer", { error: '' })
  })
  .post(function (req, res) {
    const { customerName, mobile_no, transaction_amount, transaction_type, remarks } = req.body;
    const amount = parseFloat(transaction_amount);
    const customer = new Customer({
      customerName,
      mobile_no
    });
    customer.transactions.push({
      transaction_amount: amount,
      transaction_type: transaction_type,
      remarks: remarks
    })
    if (transaction_type === "credit") {
      customer.balance -= amount;
    } else if (transaction_type === "debit") {
      customer.balance += amount;
    }
    customer.save()
      .then(function () {
        res.redirect('/');
      })
      .catch(function (error) {
        console.error(error, req.body);
        res.render("addCustomer", {
          error: "Customer Name and Mobile Number should be unique",
          FormData: req.body  // Pass the previously entered form data back
        });
      })
  })


app.get('/viewCustomer', (req, res) => {
  const customerId = req.query.customerId;

  Customer.findOne({ customerId }).exec()
    .then(customer => {
      res.render('viewCustomer', { customer, parseDate });
    })
    .catch(error => {
      console.error('Error retrieving customer details:', error);
      res.status(500).send('Error retrieving customer details');
    });
});


app.get("/allCustomers", function (req, res) {
  Customer.find({}).then(function (customers) {
    res.render("allCustomers", {
      customers: customers,
    });
  })
    .catch(function (err) {
      console.log(err);
    })
})


app.route('/addTransaction')
  .get(function (req, res) {
    const customerId = req.query.customerId;
    res.render('addTransaction', { customerId });
  })

  .post(function (req, res) {
    const { customerId, transactionAmount, transactionType, remarks } = req.body;
    const amount = parseFloat(transactionAmount);
    const newTransaction = {
      transaction_amount: amount,
      transaction_type: transactionType,
      transaction_date: new Date().toLocaleDateString('en-GB'),
      transaction_time: new Date().toLocaleTimeString(),
      remarks: remarks
    };
    Customer.findOneAndUpdate(
      { customerId },
      { $push: { transactions: newTransaction } },
      { new: true })
      .then((updatedCustomer) => {
        if (updatedCustomer) {
          if (transactionType === 'credit') {
            updatedCustomer.balance -= amount;
          } else if (transactionType === 'debit') {
            updatedCustomer.balance += amount;
          }
          return updatedCustomer.save();
        } else {
          throw new Error('Customer not found');
        }
      })
      .then(() => {
        return Customer.findOne({ customerId }).exec();
      })
      .then((customer) => {
        res.redirect(`/viewCustomer?customerId=${customerId}`);
      })
      .catch((error) => {
        console.error(error);
        res.status(500).send('Error adding transaction');
      });
  });


//     const currentDate = new Date()
//     const transactionDate = parseDate(latestTransaction.transaction_date);
//     const timeDifference = currentDate.getTime() - transactionDate.getTime();
//     const daysDifference = Math.floor(timeDifference / (1000 * 3600 * 24));

//     if (daysDifference <= 7) {
//       customer.transactions.pop();

app.get('/modifyTransaction', (req, res) => {
  const customerId = req.query.customerId;
  const transactionId = req.query.transactionId;

  Customer.findOne({ customerId }).exec()
    .then(customer => {
      if (!customer) {
        return res.status(404).send('Customer not found');
      }

      const transaction = customer.transactions.find(t => t._id.equals(transactionId));

      if (!transaction) {
        return res.status(404).send('Transaction not found for the customer');
      }

      res.render('modifyTransaction', { customer, transaction });
    })
    .catch(error => {
      console.error('Error retrieving customer details:', error);
      res.status(500).send('Error retrieving customer details');
    });
});
app.post('/modifyLatestTransaction/:customerId', async (req, res) => {

  const customerId = req.params.customerId;
  const { transactionId, newRemarks, newTransactionType, newTransactionAmount } = req.body;
  const newAmount = parseFloat(newTransactionAmount);

  try {
    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      return res.status(404).send('Customer not found');
    }

    const transactionIndex = customer.transactions.findIndex((transaction) => transaction._id.equals(transactionId));
    if (transactionIndex === -1) {
      return res.status(404).send('Transaction not found for the customer');
    }

    const originalTransaction = customer.transactions[transactionIndex];
    const unmodifiedTransaction = originalTransaction
    console.log(unmodifiedTransaction)
    originalTransaction.remarks = newRemarks
    originalTransaction.transaction_type = newTransactionType
    console.log('transactionIndex :>> ', transactionIndex);
    if (transactionIndex === 0) {
      originalTransaction.transaction_balance = newAmount;
    }
    else {
      const previousTransaction = customer.transactions[transactionIndex - 1];
      if (originalTransaction.transaction_type === 'credit') {
        originalTransaction.transaction_balance = parseFloat(previousTransaction.transaction_balance) - newAmount;
      } else if (originalTransaction.transaction_type === 'debit') {
        originalTransaction.transaction_balance = parseFloat(previousTransaction.transaction_balance) + newAmount;
      }
    }
    originalTransaction.transaction_amount = newAmount
    customer.balance = originalTransaction.transaction_balance

    for (let i = transactionIndex + 1; i < customer.transactions.length; i++) {
      prevBalance = customer.transactions[i - 1].transaction_balance;
      const currentTransaction = customer.transactions[i];
      if (currentTransaction.transaction_type === 'credit') {
        currentTransaction.transaction_balance = prevBalance - parseFloat(currentTransaction.transaction_amount);
      } else if (currentTransaction.transaction_type === 'debit') {
        currentTransaction.transaction_balance = prevBalance + parseFloat(currentTransaction.transaction_amount);
      }
      customer.balance = currentTransaction.transaction_balance;
    }
    console.log('originalTransaction :>> ', originalTransaction);
    customer.transactions[transactionIndex] = originalTransaction;
    await customer.save();

    res.redirect(`/viewCustomer?customerId=${customerId}`);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error modifying latest transaction');
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});