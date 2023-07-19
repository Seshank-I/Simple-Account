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
    type: Date,
    default: Date.now()
  }
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
  transactions: [transactionSchema]
})

customerSchema.pre('save', async function (next) { // incremental customerId
  if (!this.customerId) {
    try {
      const count = await this.constructor.countDocuments();
      this.customerId = count + 1;
    } catch (error) {
      console.error(error);
      throw new Error('Error generating customer ID');
    }
  }
  next();
});

const Customer = mongoose.model("customer", customerSchema)


app.route("/")
  .get((req, res) => { //landing page
    res.render("index")
  })
  .post(function (req, res) { //search
    const customerName = req.params.customerName;
    Customer.findOne({ name: customerName }).exec()
      .then(function (foundCustomer) {
        res.send(foundCustomer)
      })
      .catch(function (err) {
        console.log(err)
      })
  })


app.route("/addCustomer")
  .get(function (req, res) {
    res.render("addCustomer")
  })
  .post(function (req, res) {
    console.log("addcustomers post");
    const { customerName, mobile_no, transaction_amount, transaction_type } = req.body;
    const customer = new Customer({
      customerName,
      mobile_no
    });
    customer.transactions.push({
      transaction_amount: transaction_amount,
      transaction_type: transaction_type
    })
    if (transaction_type === "credit") {
      customer.balance -= transaction_amount;
    } else if (transaction_type === "debit") {
      customer.balance += transaction_amount;
    }
    customer.save().then(function () {
      res.redirect('/');
    })
      .catch(function (error) {
        console.error(error);
        res.status(500).send('Error adding customer');
      })
  })


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



app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
