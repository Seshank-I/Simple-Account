import sqlite3
import requests


def get_customers():
    connection = sqlite3.connect('billing.db')
    cursor = connection.cursor()

    cursor.execute('SELECT * FROM customers')
    customers = cursor.fetchall()

    return customers


def get_transactions(customer_id):
    connection = sqlite3.connect('billing.db')
    cursor = connection.cursor()

    cursor.execute(
        'SELECT * FROM transactions WHERE customer_id = ?', (customer_id,))
    transactions = cursor.fetchall()

    return transactions
