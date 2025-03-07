import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import math
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn import tree
from sklearn.metrics import classification_report, accuracy_score
import joblib  # Added for saving the model

import warnings
warnings.filterwarnings("ignore")

# Load and preprocess data
df = pd.read_csv("C:\\Users\\Aryan Prasad\\Desktop\\web Development aryan\\loan bot\\datasets\\loan_approval_dataset.csv")
df = df.drop(["loan_id"], axis=1)

print(df.info())

le = LabelEncoder()
df[" education"] = le.fit_transform(df[" education"])
df[" self_employed"] = le.fit_transform(df[" self_employed"])
df[" loan_status"] = le.fit_transform(df[" loan_status"])

print(df.head())

x = df.drop([" loan_status"], axis=1)
y = df[" loan_status"]

x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)

model = tree.DecisionTreeClassifier()
model.fit(x_train, y_train)
dtreepred = model.predict(x_test)

print("Accuracy of Decision Tree is:", model.score(x_test, y_test) * 100)

sample_input = np.array([[2, 1, 1, 500000, 5000000, 40, 750, 0, 0, 0, 0]])
# no_of_dependents  education  self_employed  income_annum  loan_amount  loan_term  cibil_score  residential_assets_value  commercial_assets_value  luxury_assets_value  bank_asset_value
prediction = model.predict(sample_input)[0]
loan_status = "Approved" if prediction == 1 else "Rejected"
print("\nLoan Prediction Result:", loan_status)

joblib.dump(model, "loan_model.joblib")
print("Model saved successfully as 'loan_model.joblib'")