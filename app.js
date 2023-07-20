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
  remarks: String
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


customerSchema.pre('save', async function (next) {
  // Incremental customerId
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
    res.render("addCustomer")
  })
  .post(function (req, res) {
    console.log("addcustomers post");
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
    customer.save().then(function () {
      res.redirect('/');
    })
      .catch(function (error) {
        console.error(error);
        res.status(500).send('Error adding customer');
      })
  })


app.get('/viewCustomer', (req, res) => {
  const customerId = req.query.customerId;

  Customer.findOne({ customerId }).exec()
    .then(customer => {
      res.render('viewCustomer', { customer });
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
    // Find the corresponding customer and push a new transaction to their transactions array
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
        // Render the viewCustomer page with the updated customer data
        return Customer.findOne({ customerId }).exec();
      })
      .then((customer) => {
        res.render('viewCustomer', { customer });
      })
      .catch((error) => {
        console.error(error);
        res.status(500).send('Error adding transaction');
      });
    res.redirect('/');
  });


function parseDate(dateString) {
  const [day, month, year] = dateString.split("/");
  return new Date(`${year} ${month} ${day}`);
}

app.post('/deleteLatestTransaction/:customerId', async (req, res) => {
  const customerId = req.params.customerId;
  try {
    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      return res.status(404).send('Customer not found');
    }
    const latestTransaction = customer.transactions[customer.transactions.length - 1];

    if (!latestTransaction) {
      return res.status(404).send('No transactions found for the customer');
    }

    const currentDate = new Date()
    const transactionDate = parseDate(latestTransaction.transaction_date);
    const timeDifference = currentDate.getTime() - transactionDate.getTime();
    const daysDifference = Math.floor(timeDifference / (1000 * 3600 * 24));

    if (daysDifference <= 7) {
      customer.transactions.pop();

      if (latestTransaction.transaction_type === 'credit') {
        customer.balance += latestTransaction.transaction_amount;
      } else if (latestTransaction.transaction_type === 'debit') {
        customer.balance -= latestTransaction.transaction_amount;
      }

      await customer.save();

      res.redirect(`/viewCustomer?customerId=${customerId}`);
    } else {
      return res.status(403).send('Latest transaction cannot be deleted as it is older than 1 week');
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send('Error deleting latest transaction');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
