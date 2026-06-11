"""CredCore - Full System Test Suite (v2 - 100% target)"""
import requests, json, sys, uuid, os

BASE = os.environ.get("CREDCORE_TEST_URL", "http://localhost:8000/api/v1")
_ADMIN_EMAIL = os.environ.get("CREDCORE_ADMIN_EMAIL", "admin@credcore.local")
_ADMIN_PWD = os.environ.get("CREDCORE_ADMIN_PASSWORD", "AdminCredCore123!")
results = []

def ok(name): results.append(("OK", name))
def err(name, e): results.append(("ERR", name, str(e)[:150]))

# ═══════════ LOGIN ═══════════
r = requests.post(f"{BASE}/auth/auth/login/", json={"email":_ADMIN_EMAIL,"password":_ADMIN_PWD})
assert r.status_code == 200, f"Login failed: {r.text}"
token = r.json()["access"]
refresh_token = r.json()["refresh"]
H = {"Authorization": f"Bearer {token}"}
HP = {**H, "Content-Type": "application/json"}
ok("Login + JWT Token")

# ═══════════ GET ENDPOINTS (29 tests) ═══════════
get_tests = [
    ("Health Check",        "/health/"),
    ("Dashboard",           "/dashboard/"),
    ("Dashboard KPIs",      "/dashboard/kpis/"),
    ("Dashboard Charts",    "/dashboard/charts/"),
    ("Dashboard Alerts",    "/dashboard/alerts/"),
    ("Investor Dashboard",  "/dashboard/investors/"),
    ("Company Settings",    "/dashboard/company/"),
    ("Earnings",            "/dashboard/earnings/"),
    ("Backup Config",       "/dashboard/backup/config/"),
    ("Backup List",         "/dashboard/backup/list/"),
    ("Customers",           "/customers/"),
    ("Loan Products",       "/loan-products/"),
    ("Loan Applications",   "/loan-applications/"),
    ("Loans",               "/loans/"),
    ("Payments",            "/payments/"),
    ("Collections",         "/collections/"),
    ("Cash Transactions",   "/cash/"),
    ("Guarantees",          "/guarantees/"),
    ("Branches",            "/branches/"),
    ("Users",               "/auth/users/"),
    ("Roles",               "/auth/roles/"),
    ("Report Loans",        "/reports/loans/"),
    ("Report Payments",     "/reports/payments/"),
    ("Report Portfolio",    "/reports/portfolio/"),
    ("Export Customers XLS","/reports/export/customers/"),
    ("Export Loans XLS",    "/reports/export/loans/"),
    ("Export Payments XLS", "/reports/export/payments/"),
    ("Export Master Report","/reports/export/master/"),
    ("Import Template XLS", "/reports/import/template/"),
]

for name, url in get_tests:
    try:
        r = requests.get(f"{BASE}{url}", headers=H, timeout=15)
        assert r.status_code == 200, f"HTTP {r.status_code}"
        ok(name)
    except Exception as e:
        err(name, e)

# ═══════════ WRITE OPERATIONS ═══════════

# Unique suffix to avoid duplicates
uid = uuid.uuid4().hex[:6]

# 1. Create customer
cust_id = None
try:
    r = requests.post(f"{BASE}/customers/", headers=HP, json={
        "first_name":"Test","last_name":f"V2_{uid}","customer_type":"NATURAL",
        "id_type":"CEDULA","id_number":f"402-{uid[:3]}0{uid[3:]}-1","phone1":"8091230000",
        "email":f"test_{uid}@credcore.local","address":"Calle Test 1","monthly_income":60000,"branch":1
    }, timeout=15)
    assert r.status_code == 201, f"HTTP {r.status_code}: {r.text[:200]}"
    cust_id = r.json()["id"]
    ok(f"Create Customer")
except Exception as e: err("Create Customer", e)

# 2. Update customer
if cust_id:
    try:
        r = requests.patch(f"{BASE}/customers/{cust_id}/", headers=HP, json={"phone2":"8097654321"}, timeout=10)
        assert r.status_code == 200
        ok("Update Customer")
    except Exception as e: err("Update Customer", e)

# 3. Create loan application
app_id = None
if cust_id:
    try:
        r = requests.post(f"{BASE}/loan-applications/", headers=HP, json={
            "customer":cust_id,"product":1,"requested_amount":20000,
            "requested_term_months":6,"purpose":"Test capital","branch":1
        }, timeout=15)
        assert r.status_code == 201, f"HTTP {r.status_code}: {r.text[:200]}"
        app_id = r.json()["id"]
        ok("Create Application")
    except Exception as e: err("Create Application", e)

# 4. Submit application (DRAFT -> SUBMITTED)
if app_id:
    try:
        r = requests.post(f"{BASE}/loan-applications/{app_id}/submit/", headers=HP, json={}, timeout=10)
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
        ok("Submit Application")
    except Exception as e: err("Submit Application", e)

# 5. Start review (SUBMITTED -> UNDER_REVIEW)
if app_id:
    try:
        r = requests.post(f"{BASE}/loan-applications/{app_id}/start_review/", headers=HP, json={}, timeout=10)
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
        ok("Start Review")
    except Exception as e: err("Start Review", e)

# 6. Approve application (UNDER_REVIEW -> APPROVED)
if app_id:
    try:
        r = requests.post(f"{BASE}/loan-applications/{app_id}/approve/", headers=HP, json={
            "approved_amount":20000,"approved_rate":5.0,"approved_term_months":6,"comments":"Test aprobado"
        }, timeout=10)
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
        ok("Approve Application")
    except Exception as e: err("Approve Application", e)

# 7. Disburse loan (APPROVED -> DISBURSED + creates Loan)
loan_id = None
if app_id:
    try:
        r = requests.post(f"{BASE}/loan-applications/{app_id}/disburse/", headers=HP, json={
            "disbursement_date":"2026-06-08"
        }, timeout=15)
        assert r.status_code in [200,201], f"HTTP {r.status_code}: {r.text[:200]}"
        data = r.json()
        loan_id = data.get("loan_id") or data.get("loan",{}).get("id") or data.get("id")
        ok("Disburse Loan")
    except Exception as e: err("Disburse Loan", e)

# Fallback: get loan from list if disburse didn't return id
if not loan_id:
    r = requests.get(f"{BASE}/loans/", headers=H, timeout=10)
    loans = r.json().get("results", [])
    if loans:
        loan_id = loans[0]["id"]

# 8. Register payment
pay_id = None
if loan_id:
    try:
        r = requests.post(f"{BASE}/payments/", headers=HP, json={
            "loan":loan_id,"total_amount":4000,"payment_type":"REGULAR",
            "payment_method":"CASH","payment_date":"2026-06-08"
        }, timeout=10)
        assert r.status_code == 201, f"HTTP {r.status_code}: {r.text[:200]}"
        pay_id = r.json()["id"]
        ok("Register Payment")
    except Exception as e: err("Register Payment", e)

# 9. Create guarantee
if loan_id and cust_id:
    try:
        r = requests.post(f"{BASE}/guarantees/", headers=HP, json={
            "loan":loan_id,"customer":cust_id,"guarantee_type":"VEHICLE",
            "description":f"Toyota Test {uid}","estimated_value":600000
        }, timeout=10)
        assert r.status_code == 201, f"HTTP {r.status_code}: {r.text[:200]}"
        ok("Create Guarantee")
    except Exception as e: err("Create Guarantee", e)

# 10. Verify admin
try:
    r = requests.post(f"{BASE}/auth/auth/verify_admin/", headers=HP, json={
        "admin_email":_ADMIN_EMAIL,"admin_password":_ADMIN_PWD
    }, timeout=10)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
    ok("Verify Admin")
except Exception as e: err("Verify Admin", e)

# 11. Create user (unique email/username)
try:
    r = requests.post(f"{BASE}/auth/users/", headers=HP, json={
        "email":f"user_{uid}@credcore.local","username":f"user_{uid}",
        "password":"TestPass12345!","password_confirm":"TestPass12345!",
        "first_name":"Test","last_name":f"User_{uid}"
    }, timeout=10)
    assert r.status_code == 201, f"HTTP {r.status_code}: {r.text[:200]}"
    ok("Create User")
except Exception as e: err("Create User", e)

# 12. Update company settings
try:
    r = requests.patch(f"{BASE}/dashboard/company/", headers=HP, json={"company_name":"CredCore"}, timeout=10)
    assert r.status_code == 200
    ok("Update Company Settings")
except Exception as e: err("Update Company", e)

# 13. PDF Receipt
if pay_id:
    try:
        r = requests.get(f"{BASE}/reports/pdf/receipt/{pay_id}/", headers=H, timeout=15)
        assert r.status_code == 200, f"HTTP {r.status_code}"
        ok("PDF Receipt")
    except Exception as e: err("PDF Receipt", e)

# 14-16. PDF Amortization, Contract, Statement
if loan_id:
    for name, path in [("PDF Amortization","amortization"),("PDF Contract","contract"),("PDF Statement","statement")]:
        try:
            r = requests.get(f"{BASE}/reports/pdf/{path}/{loan_id}/", headers=H, timeout=15)
            assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:100] if r.headers.get('content-type','').startswith('text') else 'binary'}"
            ok(name)
        except Exception as e: err(name, e)

# 17. Token refresh
try:
    r = requests.post(f"{BASE}/auth/token/refresh/", json={"refresh": refresh_token}, timeout=10)
    assert r.status_code == 200, f"HTTP {r.status_code}"
    ok("Token Refresh")
except Exception as e: err("Token Refresh", e)

# ═══════════ RESULTS ═══════════
print()
print("=" * 64)
print("   CREDCORE - FULL SYSTEM TEST RESULTS")
print("=" * 64)
ok_count = 0
err_count = 0
for r in results:
    if r[0] == "OK":
        print(f"  [PASS]  {r[1]}")
        ok_count += 1
    else:
        print(f"  [FAIL]  {r[1]}")
        print(f"          {r[2]}")
        err_count += 1
total = ok_count + err_count
print("=" * 64)
print(f"   TOTAL: {ok_count}/{total} PASSED  ({ok_count*100//total}%)")
if err_count == 0:
    print("   ALL TESTS PASSED!")
else:
    print(f"   {err_count} FAILED")
print("=" * 64)
