from flask import Flask, render_template, request

app = Flask(__name__, template_folder="templates")

def calculate_monthly_payment(principal, annual_rate, years):
    """Calculate monthly payment for a loan."""
    monthly_rate = annual_rate / 12 / 100
    total_months = years * 12
    if monthly_rate == 0:
        return principal / total_months
    payment = principal * (monthly_rate * (1 + monthly_rate) ** total_months) / ((1 + monthly_rate) ** total_months - 1)
    return payment

def get_loan_rates(loan_type):
    """Return interest rates for ICICI, Axis, HDFC, and SBI based on loan type."""
    rates = {
        "personal": {
            "ICICI Bank": 10.85,
            "Axis Bank": 10.49,
            "HDFC Bank": 10.50,
            "SBI": 11.45
        },
        "home": {
            "ICICI Bank": 8.75,
            "Axis Bank": 8.55,
            "HDFC Bank": 8.75,
            "SBI": 8.50
        },
        "car": {
            "ICICI Bank": 9.10,
            "Axis Bank": 9.25,
            "HDFC Bank": 9.00,
            "SBI": 8.85
        },
        "education": {
            "ICICI Bank": 9.50,
            "Axis Bank": 9.75,
            "HDFC Bank": 9.55,
            "SBI": 8.65
        }
    }
    return rates.get(loan_type.lower(), {})

@app.route("/", methods=["GET", "POST"])
def compare_loans():
    results = None
    error = None
    form_data = {"loan_type": "", "principal": "", "years": ""}  # Default empty values

    if request.method == "POST":
        try:
            loan_type = request.form["loan_type"].strip().lower()
            principal = float(request.form["principal"])
            years = int(request.form["years"])

            # Store the entered values
            form_data = {"loan_type": loan_type, "principal": principal, "years": years}

            banks = get_loan_rates(loan_type)
            if not banks:
                error = "Invalid loan type selected! Choose Personal, Home, Car, or Education."
            else:
                results = []
                for bank, rate in banks.items():
                    monthly_payment = calculate_monthly_payment(principal, rate, years)
                    total_paid = monthly_payment * years * 12
                    total_interest = total_paid - principal
                    results.append({
                        "bank": bank,
                        "rate": rate,
                        "monthly_payment": monthly_payment,
                        "total_interest": total_interest
                    })
        except ValueError:
            error = "Please enter valid numeric values for loan amount and term."
        except Exception as e:
            error = f"An error occurred: {str(e)}"

    return render_template("index.html", results=results, error=error, form_data=form_data)

if __name__ == "__main__":
    app.run(debug=True)