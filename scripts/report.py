#!/usr/bin/env python3
import json
import pandas as pd
import plotly.express as px
import matplotlib.pyplot as plt
import sys
from datetime import datetime


def dogant(data):
    # Convert data to DataFrame
    df = pd.DataFrame(data)

    # Convert Unix timestamps to readable dates
    df['start_date'] = pd.to_datetime(df['start_date'], unit='s')
    df['end_date'] = pd.to_datetime(df['end_date'], unit='s')

    # Create a Gantt chart
    fig = px.timeline(df, x_start="start_date", x_end="end_date", y="user_id", color="type", title="Subscription Periods")
    fig.update_yaxes(title="User ID")
    fig.update_xaxes(title="Date")
    fig.update_layout(showlegend=True)

    # Current date
    current_date = datetime.now()

    # Add a vertical line for the current date
    fig.add_shape(
        dict(
            type="line",
            x0=current_date,
            y0=0,
            x1=current_date,
            y1=1,
            xref='x',
            yref='paper',
            line=dict(color="Red", width=2)
        )
    )

    # Update layout for the shape
    fig.update_layout(
        shapes=[
            dict(
                type="line",
                x0=current_date,
                x1=current_date,
                y0=0,
                y1=1,
                xref='x',
                yref='paper',
                line=dict(color="Purple", width=1)
            )
        ]
    )

    fig.show()

def calc_subs(data):
    # Convert JSON data to DataFrame
    subscriptions = []
    max_date = datetime(2100, 1, 1)

    for entry in data:
        if not 'transactions' in entry['value']:
            continue

        transactions = entry['value']['transactions']
        pubkey = entry['value']['pubkey']
        for transaction in transactions:
            start_date = transaction['start_date']
            end_date = transaction['end_date']
            purchased_date = transaction['purchased_date']
            duration = transaction['duration']
            
            if start_date is None:
                start_date = purchased_date
            
            if end_date is None and duration is not None:
                end_date = start_date + duration
            
            transaction['start_date'] = start_date
            transaction['end_date'] = end_date

            transaction.pop('duration', None)
            transaction.pop('purchased_date', None)

            if end_date > (4102473600 * 2):
                print("{} has bad end date".format(transaction), file=sys.stderr)
                continue
            
            if start_date is not None and end_date is not None:
                subscriptions.append({
                    'start_date': start_date,
                    'end_date': end_date,
                    'type': transaction['type'],
                    'user_id': int(entry['key']),
                    'pubkey': pubkey
                })
            else:
                print("missing start or end date in {}".format(transaction), file=sys.stderr)

    return subscriptions


def load_data():
    with open('accounts.json', 'r') as file:
        return json.load(file)

def active_subs_plot(data):
    # Convert data to DataFrame
    df = pd.DataFrame(data)

    # Convert Unix timestamps to datetime
    df['start_date'] = pd.to_datetime(df['start_date'], unit='s')
    df['end_date'] = pd.to_datetime(df['end_date'], unit='s')

    # Define the end of the next year
    end_of_year = pd.Timestamp.now() + pd.DateOffset(months=2)

    # Create a date range for each subscription
    df['date_range'] = df.apply(lambda row: pd.date_range(start=row['start_date'], end=row['end_date'], freq='D'), axis=1)

    # Explode the date_range to get a row for each day a subscription is active
    df = df.explode('date_range')

    # Ensure date_range is datetime type
    df['date_range'] = pd.to_datetime(df['date_range'])

    # Filter out dates beyond the end of the next year
    df = df[df['date_range'] <= end_of_year]

    # Count active subscriptions per month and type
    df['month'] = df['date_range'].dt.to_period('M')
    monthly_active_subscriptions = df.groupby(['month', 'type'])['user_id'].nunique().unstack().fillna(0)

    colors = {'iap': '#00CC96', 'ln': '#EF553B'}

    # Plotting
    plt.figure(figsize=(14, 8))
    monthly_active_subscriptions.plot(kind='bar', stacked=True, color=[colors.get(x, '#636EFA') for x in monthly_active_subscriptions.columns], ax=plt.gca())
    plt.title('Monthly Active Subscriptions by Type')
    plt.xlabel('Month')
    plt.ylabel('Number of Active Subscriptions')
    plt.xticks(rotation=45)
    plt.legend(title='Subscription Type')
    plt.tight_layout()
    plt.show()


def write_subs(subs):
    with open('subscriptions.json', 'w') as file:
        json.dump(subs, file)

def print_data():
    data = load_data()
    subs = calc_subs(data)
    print(json.dumps(subs))

def report():
    # Example JSON data (you can replace this with loading your actual JSON data)
    data = load_data()
    subs = calc_subs(data)

    active_subs_plot(subs)
    dogant(subs)

    write_subs(subs)

def subs_report():
    data = load_data()
    subs = calc_subs(data)
    write_subs(subs)

if len(sys.argv) > 1:
	func_name = sys.argv[1]
	if func_name in globals() and callable(globals()[func_name]):
		globals()[func_name]()
	else:
		print(f"Error: Unknown command '{func_name}'.")
else:
	report()

