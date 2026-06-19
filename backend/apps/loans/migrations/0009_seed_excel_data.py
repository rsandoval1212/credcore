from datetime import date, timedelta
from decimal import Decimal
import json
from django.db import migrations, transaction as _tx


SEED_JSON = """[{"cedula": "403-2061898-3", "first_name": "Josseph", "last_name": "Hhusseppe", "phone": "8295775594", "address": "DON JUAN", "guarantee": "UN APARTAMENTO", "amount": 125000.0, "loan_date": "2025-12-11", "first_payment_date": "2026-01-11", "monthly_payment": 18345.0, "term_months": 12, "paid_installments": 3, "last_payment_date": "2026-03-04"}, {"cedula": "SIN-006", "first_name": "Yoanni", "last_name": "Tejada Bido", "phone": "8094584976", "address": "PAYABO", "guarantee": "UN CSA", "amount": 10000.0, "loan_date": "2025-12-22", "first_payment_date": "2026-01-22", "monthly_payment": 2400.0, "term_months": 5, "paid_installments": 1, "last_payment_date": null}, {"cedula": "SIN-008", "first_name": "Yoni", "last_name": "Belen Pelu", "phone": "8292176501", "address": "DON JUAN", "guarantee": "NO", "amount": 10000.0, "loan_date": "2025-12-26", "first_payment_date": "2026-01-11", "monthly_payment": 12000.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "026-0071812-2", "first_name": "Ervi", "last_name": "Sorrilla Mapo", "phone": "8493424837", "address": "PAYABO", "guarantee": "NO", "amount": 10000.0, "loan_date": "2026-01-02", "first_payment_date": "2026-01-25", "monthly_payment": 6500.0, "term_months": 2, "paid_installments": 0, "last_payment_date": null}, {"cedula": "008-0004175-8", "first_name": "Amauri", "last_name": "Manbru", "phone": "8296336008", "address": "DON JUAN", "guarantee": "UN SOLAR", "amount": 75000.0, "loan_date": "2026-01-08", "first_payment_date": "2026-02-08", "monthly_payment": 10400.0, "term_months": 12, "paid_installments": 3, "last_payment_date": null}, {"cedula": "SIN-018", "first_name": "Victor", "last_name": "Rijo", "phone": "8292166633", "address": "DON JUAN", "guarantee": "NO", "amount": 5000.0, "loan_date": "2025-12-29", "first_payment_date": "2026-01-17", "monthly_payment": 6000.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "402-3146153-0", "first_name": "Eri", "last_name": "Tejada", "phone": "8495148287", "address": "PAYABO", "guarantee": "NO", "amount": 15000.0, "loan_date": "2026-02-11", "first_payment_date": "2026-03-11", "monthly_payment": 10.0, "term_months": 10, "paid_installments": 2, "last_payment_date": null}, {"cedula": "402-3790385-7", "first_name": "Anbiori", "last_name": "Brasovan", "phone": "8099538647", "address": "DONJUAN", "guarantee": "NO", "amount": 8000.0, "loan_date": "2026-02-14", "first_payment_date": null, "monthly_payment": 1000.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "008-0025783-4", "first_name": "Jua", "last_name": "Danilo", "phone": "8093897606", "address": "FRIA", "guarantee": "", "amount": 4000.0, "loan_date": "2026-02-22", "first_payment_date": "2026-02-28", "monthly_payment": 2.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "402-4422428-9", "first_name": "Jerson", "last_name": "Polanco", "phone": "2092247547", "address": "DONJUAN", "guarantee": "NO", "amount": 10000.0, "loan_date": "2026-02-25", "first_payment_date": null, "monthly_payment": 1000.0, "term_months": 1, "paid_installments": 4, "last_payment_date": null}, {"cedula": "008-0037993-5", "first_name": "Quendi", "last_name": "Contrera", "phone": "8293924199", "address": "QUENDI CONTRERA", "guarantee": "NO", "amount": 5000.0, "loan_date": "2026-03-04", "first_payment_date": null, "monthly_payment": 500.0, "term_months": 1, "paid_installments": 5, "last_payment_date": null}, {"cedula": "402-3803935-4", "first_name": "Ronar Encarncion", "last_name": "De Lo Santo", "phone": "8294745125", "address": "SERRO", "guarantee": "NO", "amount": 15000.0, "loan_date": "2026-03-05", "first_payment_date": null, "monthly_payment": 1500.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "402-2094707-7", "first_name": "Bictor", "last_name": "Manuer Sanches", "phone": "8493445000", "address": "DONJUAN", "guarantee": "PEPELE DE CASA", "amount": 35000.0, "loan_date": "2026-03-13", "first_payment_date": "2026-04-13", "monthly_payment": 12.0, "term_months": 12, "paid_installments": 1, "last_payment_date": null}, {"cedula": "008-0037773-1", "first_name": "Santo Der", "last_name": "Rosario Gusman", "phone": "8293766389", "address": "DONJUAN", "guarantee": "PAPELE DE CASA", "amount": 30000.0, "loan_date": "2026-03-13", "first_payment_date": null, "monthly_payment": 12.0, "term_months": 12, "paid_installments": 1, "last_payment_date": null}, {"cedula": "008-0006270-5", "first_name": "Jose", "last_name": "Rafaer Papalo", "phone": "8493838802", "address": "DONJUAN", "guarantee": "NO", "amount": 4000.0, "loan_date": "2026-03-18", "first_payment_date": null, "monthly_payment": 400.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "008-0019688-3", "first_name": "Juan", "last_name": "Hisidro Muese", "phone": "8297125097", "address": "SERRO", "guarantee": "NO", "amount": 2000.0, "loan_date": "2026-03-19", "first_payment_date": "2026-03-25", "monthly_payment": 2500.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "001-0215880-5", "first_name": "Sorguia", "last_name": "Rodrigue", "phone": "8293149106", "address": "SALAO", "guarantee": "PAPELE SOLAR", "amount": 32000.0, "loan_date": "2026-03-20", "first_payment_date": "2026-04-20", "monthly_payment": 12.0, "term_months": 12, "paid_installments": 2, "last_payment_date": null}, {"cedula": "005-0029611-6", "first_name": "Jose", "last_name": "Quesada", "phone": "8292094929", "address": "SAVA DER RIO", "guarantee": "NO", "amount": 10000.0, "loan_date": "2026-03-21", "first_payment_date": "2026-04-21", "monthly_payment": 5.0, "term_months": 5, "paid_installments": 1, "last_payment_date": null}, {"cedula": "008-0028356-6", "first_name": "Joervi", "last_name": "Santiago Perez", "phone": "8294317186", "address": "FRIA", "guarantee": "NO", "amount": 10000.0, "loan_date": "2026-03-23", "first_payment_date": null, "monthly_payment": 1000.0, "term_months": 1, "paid_installments": 4, "last_payment_date": null}, {"cedula": "008-0021624-4", "first_name": "Hidersa", "last_name": "Vasarte", "phone": "8298519689", "address": "FRIA", "guarantee": "NO", "amount": 10000.0, "loan_date": "2026-04-01", "first_payment_date": null, "monthly_payment": 1000.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "008-0004744-1", "first_name": "Simon", "last_name": "Florentino Quinba", "phone": "8295228755", "address": "PAYABO", "guarantee": "NO", "amount": 12000.0, "loan_date": "2026-04-02", "first_payment_date": null, "monthly_payment": 1200.0, "term_months": 1, "paid_installments": 4, "last_payment_date": null}, {"cedula": "093-0050881-0", "first_name": "Espifanio", "last_name": "Fellito Sastre", "phone": "8297807093", "address": "DONJUAN", "guarantee": "NO", "amount": 8500.0, "loan_date": "2026-04-07", "first_payment_date": null, "monthly_payment": 850.0, "term_months": 1, "paid_installments": 4, "last_payment_date": null}, {"cedula": "008-0021396-9", "first_name": "Espifanio", "last_name": "Favian Medrano", "phone": "8092970208", "address": "GALINDO", "guarantee": "NO", "amount": 15000.0, "loan_date": "2026-06-18", "first_payment_date": null, "monthly_payment": 1500.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "402-4848823-5", "first_name": "Randi", "last_name": "Jesusmende Tavera", "phone": "8495045831", "address": "YAMASA", "guarantee": "NO", "amount": 10000.0, "loan_date": "2026-04-09", "first_payment_date": null, "monthly_payment": 6500.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "008-0009260-3", "first_name": "Arfredo Jimenes", "last_name": "Ribera Tito", "phone": "8293015833", "address": "DONJUAN", "guarantee": "papele casa", "amount": 40000.0, "loan_date": "2026-04-09", "first_payment_date": null, "monthly_payment": 5500.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "001-0213305-5", "first_name": "Mario", "last_name": "Jaque", "phone": "8298402575", "address": "LOS SALAO", "guarantee": "NO", "amount": 3000.0, "loan_date": "2026-04-10", "first_payment_date": null, "monthly_payment": 3800.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "402-3537185-9", "first_name": "Yordani", "last_name": "Santana", "phone": "8296966753", "address": "LOS GUINEO", "guarantee": "NO", "amount": 50000.0, "loan_date": "2026-04-11", "first_payment_date": null, "monthly_payment": 6000.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "090-0005143-4", "first_name": "Ector", "last_name": "Sorrilla", "phone": "8299392364", "address": "LOS GUINEO", "guarantee": "NO", "amount": 15000.0, "loan_date": "2026-04-16", "first_payment_date": null, "monthly_payment": 1500.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "008-0016806-4", "first_name": "Toni", "last_name": "Vatista", "phone": "8094800410", "address": "DONJUAN", "guarantee": "TITULO FINCA", "amount": 25000.0, "loan_date": "2026-04-20", "first_payment_date": null, "monthly_payment": 10500.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "008-0022262-2", "first_name": "Aira", "last_name": "Dejesus Heredia", "phone": "8292826457", "address": "DONJUAN", "guarantee": "UN SOLAR", "amount": 40000.0, "loan_date": "2026-06-18", "first_payment_date": null, "monthly_payment": 5500.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "003-0051033-4", "first_name": "Yanetterosario", "last_name": "Sin Apellido", "phone": "8494909283", "address": "YAMASA", "guarantee": "NO", "amount": 12000.0, "loan_date": "2026-06-18", "first_payment_date": null, "monthly_payment": 1200.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "008-0006589-8", "first_name": "Rafael", "last_name": "De Jesus", "phone": "8297892414", "address": "DONJUAN", "guarantee": "NO", "amount": 5000.0, "loan_date": "2026-04-27", "first_payment_date": null, "monthly_payment": 500.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "052-0009701-1", "first_name": "Santo", "last_name": "Tomas Plasencia", "phone": "8293518777", "address": "LOS GUINEO", "guarantee": "NO", "amount": 10000.0, "loan_date": "2026-04-10", "first_payment_date": null, "monthly_payment": 1000.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "SIN-100", "first_name": "Gregorio", "last_name": "Siprian", "phone": "8293149106", "address": "LOS SALAO", "guarantee": "NO", "amount": 10000.0, "loan_date": "2026-04-30", "first_payment_date": null, "monthly_payment": 2300.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "225-0050297-0", "first_name": "Yabeli", "last_name": "Dejesus", "phone": "8296219853", "address": "SAVANA DER RIO", "guarantee": "NO", "amount": 10000.0, "loan_date": "2026-05-01", "first_payment_date": null, "monthly_payment": 2500.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "402-3537298-0", "first_name": "Jose", "last_name": "Miguer", "phone": "8295259788", "address": "FRIA", "guarantee": "NO", "amount": 15000.0, "loan_date": "2026-05-01", "first_payment_date": null, "monthly_payment": 1500.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "008-0025100-1", "first_name": "Meiia", "last_name": "Martines Papolo", "phone": "8293523086", "address": "VENAO", "guarantee": "NO", "amount": 4000.0, "loan_date": "2026-05-01", "first_payment_date": null, "monthly_payment": 400.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "402-3922819-6", "first_name": "Eva", "last_name": "Morillo", "phone": "8298718548", "address": "OYO DE PUN", "guarantee": "titulo", "amount": 4000.0, "loan_date": "2026-05-02", "first_payment_date": null, "monthly_payment": 2500.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "402-2503076-2", "first_name": "Solanyi", "last_name": "Jerman", "phone": "8297843964", "address": "BOSQUE", "guarantee": "NO", "amount": 10000.0, "loan_date": "2026-05-02", "first_payment_date": null, "monthly_payment": 2300.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "0080036724", "first_name": "Yoenni", "last_name": "Marselo Hernandez", "phone": "8098408344", "address": "LOS SERRO", "guarantee": "NO", "amount": 5000.0, "loan_date": "2026-05-04", "first_payment_date": null, "monthly_payment": 500.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "SIN-107", "first_name": "Yilo", "last_name": "Reyes", "phone": "8495345586", "address": "OYO DE PUN", "guarantee": "NO", "amount": 20000.0, "loan_date": "2026-05-04", "first_payment_date": null, "monthly_payment": 2000.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "4023275434", "first_name": "Pedro", "last_name": "Nicola Garcia", "phone": "8494713895", "address": "PAYABO", "guarantee": "TITULO", "amount": 25000.0, "loan_date": "2026-05-04", "first_payment_date": null, "monthly_payment": 2500.0, "term_months": 1, "paid_installments": 3, "last_payment_date": null}, {"cedula": "031-0572167-8", "first_name": "Rosanna", "last_name": "Gerrero Santos", "phone": "8299409178", "address": "FRIA", "guarantee": "MATRICULA", "amount": 10000.0, "loan_date": "2026-05-04", "first_payment_date": null, "monthly_payment": 1000.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "005-0051487-2", "first_name": "Maria", "last_name": "Jimenez Delarosa", "phone": "8298034184", "address": "YAMASA", "guarantee": "NO", "amount": 25000.0, "loan_date": "2026-05-04", "first_payment_date": null, "monthly_payment": 5500.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "008-0006151-7", "first_name": "Benancio", "last_name": "Martes", "phone": "8293178629", "address": "DONJUAN", "guarantee": "NO", "amount": 5000.0, "loan_date": "2026-05-11", "first_payment_date": null, "monthly_payment": 500.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "008-0006136-8", "first_name": "Domingo", "last_name": "Leiva", "phone": "8493614873", "address": "DONJUAN", "guarantee": "NO", "amount": 2000.0, "loan_date": "2026-05-16", "first_payment_date": null, "monthly_payment": 200.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "225-0091376-3", "first_name": "Pascuar", "last_name": "Figuereo", "phone": "8494770080", "address": "=YO DE PUN", "guarantee": "TITULO", "amount": 30000.0, "loan_date": "2026-05-16", "first_payment_date": null, "monthly_payment": 3000.0, "term_months": 1, "paid_installments": 4, "last_payment_date": null}, {"cedula": "008-0018250-3", "first_name": "Damaso", "last_name": "Vasarte", "phone": "8298423192", "address": "DONJUAN", "guarantee": "NO", "amount": 8000.0, "loan_date": "2026-06-18", "first_payment_date": null, "monthly_payment": 800.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "402-0110600-0", "first_name": "Quimeiry", "last_name": "Florentino", "phone": "8097209554", "address": "PAYABO", "guarantee": "NO", "amount": 7000.0, "loan_date": "2026-05-26", "first_payment_date": null, "monthly_payment": 2250.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "008-0023787-9", "first_name": "Jesus", "last_name": "Manuel Muese", "phone": "8097648816", "address": "SAVANA DER RIO", "guarantee": "NO", "amount": 5000.0, "loan_date": "2026-05-27", "first_payment_date": null, "monthly_payment": 500.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "090-0011952-0", "first_name": "Francisco", "last_name": "Antonio", "phone": "", "address": "DONJUAN", "guarantee": "TARJETA", "amount": 21500.0, "loan_date": "2026-05-27", "first_payment_date": null, "monthly_payment": 6000.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "008-0027520-8", "first_name": "Eduardo", "last_name": "Viscaino Emiliano", "phone": "8097499994", "address": "DONJUAN", "guarantee": "NO", "amount": 2000.0, "loan_date": "2026-05-29", "first_payment_date": "2026-06-15", "monthly_payment": 2500.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "008-0017031-9", "first_name": "Ramon", "last_name": "Antonio Moreno", "phone": "", "address": "DONJUAN", "guarantee": "NO", "amount": 50000.0, "loan_date": "2026-05-29", "first_payment_date": null, "monthly_payment": 5000.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "008-0028666-7", "first_name": "Osmar", "last_name": "Hernande", "phone": "8093629874", "address": "GALINDO", "guarantee": "NO", "amount": 10000.0, "loan_date": "2026-05-30", "first_payment_date": null, "monthly_payment": 1000.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "005-0015333-5", "first_name": "Francisco", "last_name": "Tanclero", "phone": "8293307516", "address": "CANO", "guarantee": "NO", "amount": 8000.0, "loan_date": "2026-05-30", "first_payment_date": null, "monthly_payment": 800.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "223-0083693-3", "first_name": "Natibida", "last_name": "Fejix Liranso", "phone": "8094060451", "address": "SERRO", "guarantee": "NO", "amount": 3000.0, "loan_date": "2026-06-30", "first_payment_date": "2026-06-30", "monthly_payment": 4000.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "008-0026859-1", "first_name": "Masimilianode", "last_name": "Santos", "phone": "8297035167", "address": "PAYABO", "guarantee": "NO", "amount": 5000.0, "loan_date": "2026-06-18", "first_payment_date": null, "monthly_payment": 500.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "223-0137189-8", "first_name": "Julio", "last_name": "Cesar Encarnacion", "phone": "8297636613", "address": "FRIA", "guarantee": "NO", "amount": 10000.0, "loan_date": "2026-06-04", "first_payment_date": null, "monthly_payment": 1000.0, "term_months": 1, "paid_installments": 2, "last_payment_date": null}, {"cedula": "402-4402806-0", "first_name": "Carlos", "last_name": "David Morel", "phone": "8096434222", "address": "oyo de pun", "guarantee": "No", "amount": 5000.0, "loan_date": "2026-06-06", "first_payment_date": null, "monthly_payment": 500.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "008-0036054-7", "first_name": "Wilis Esteban", "last_name": "Espinal Prensa", "phone": "8498863911", "address": "La hermon", "guarantee": "NO", "amount": 2000.0, "loan_date": "2026-06-06", "first_payment_date": "2026-06-25", "monthly_payment": 2500.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "071-0055060-2", "first_name": "Yonattan", "last_name": "Davi Peres", "phone": "", "address": "DONJUAN", "guarantee": "NO", "amount": 10000.0, "loan_date": "2026-06-08", "first_payment_date": null, "monthly_payment": 1000.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "008-0017059-7", "first_name": "Gravier", "last_name": "Ramire Sesperes", "phone": "8299280663", "address": "SAVANA DER RIO", "guarantee": "NO", "amount": 20000.0, "loan_date": "2026-06-08", "first_payment_date": null, "monthly_payment": 2000.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "008-0004692-2", "first_name": "Ramon", "last_name": "Bonifacio", "phone": "8299244914", "address": "DONJUAN", "guarantee": "NO", "amount": 5000.0, "loan_date": "2026-06-10", "first_payment_date": null, "monthly_payment": 500.0, "term_months": 1, "paid_installments": 1, "last_payment_date": null}, {"cedula": "008-0026923-5", "first_name": "Andrison Astacio", "last_name": "De Jesus", "phone": "8096652714", "address": "JAGUA", "guarantee": "UNA CASA", "amount": 40000.0, "loan_date": "2026-06-11", "first_payment_date": null, "monthly_payment": 1234700.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "008-0006764-7", "first_name": "Nerson", "last_name": "Polanco Flore", "phone": "8293714969", "address": "DON JUAN", "guarantee": "NO", "amount": 6000.0, "loan_date": "2026-06-13", "first_payment_date": null, "monthly_payment": 600.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "008-0033777-6", "first_name": "Cleto", "last_name": "Moreno Dauri", "phone": "8294269955", "address": "BOSQUE", "guarantee": "NO", "amount": 20000.0, "loan_date": "2026-06-13", "first_payment_date": null, "monthly_payment": 4200.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "008-0031287-8", "first_name": "Jairo", "last_name": "Miguel", "phone": "5709144813", "address": "DON JUAN", "guarantee": "NO", "amount": 25000.0, "loan_date": "2026-06-13", "first_payment_date": null, "monthly_payment": 2500.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "402-2520556-2", "first_name": "Welinton Joel", "last_name": "Polanco Moreno", "phone": "8094566662", "address": "DON JUAN", "guarantee": "NO", "amount": 8000.0, "loan_date": "2026-06-18", "first_payment_date": null, "monthly_payment": 2500.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}, {"cedula": "225-0077233-4", "first_name": "Arier", "last_name": "Hinojosa", "phone": "8299745831", "address": "FRIA", "guarantee": "NO", "amount": 23000.0, "loan_date": "2026-06-16", "first_payment_date": null, "monthly_payment": 2300.0, "term_months": 1, "paid_installments": 0, "last_payment_date": null}]"""


def seed_existing_loans(apps, schema_editor):
    Customer = apps.get_model('customers', 'Customer')
    Loan = apps.get_model('loans', 'Loan')
    Branch = apps.get_model('branches', 'Branch')
    LoanProduct = apps.get_model('loan_products', 'LoanProduct')
    LoanSchedule = apps.get_model('loans', 'LoanSchedule')
    Payment = apps.get_model('payments', 'Payment')

    seed_data = json.loads(SEED_JSON)

    User = apps.get_model('users', 'User')
    admin_user = User.objects.filter(is_superuser=True).first() or User.objects.first()

    branch = Branch.objects.filter(is_main=True).first() or Branch.objects.first()
    if not branch:
        branch = Branch.objects.create(name='Principal', code='001', is_main=True, is_active=True)

    product = LoanProduct.objects.filter(is_active=True).first()
    if not product:
        product = LoanProduct.objects.create(
            name='Prestamo Personal', code='PRES-PERS',
            min_amount=Decimal('1000'), max_amount=Decimal('1000000'),
            min_term_months=1, max_term_months=60,
            interest_rate_default=Decimal('10'), branch=branch, is_active=True,
        )

    counters = {'customers': 0, 'loans': 0, 'payments': 0, 'skipped': 0, 'errors': 0}
    error_msgs = []

    for row in seed_data:
        try:
            with _tx.atomic():
                _process_row(row, branch, product, admin_user, Customer, Loan, LoanSchedule, Payment, counters)
        except Exception as e:
            counters['errors'] += 1
            error_msgs.append('Cedula %s: %s' % (row.get('cedula','?'), str(e)[:160]))

    print('[SEED] Clientes: %d, Prestamos: %d, Pagos: %d, Saltados: %d, Errores: %d' % (
        counters['customers'], counters['loans'], counters['payments'],
        counters['skipped'], counters['errors']))
    for m in error_msgs[:10]:
        print('  ERROR:', m)


def _process_row(row, branch, product, admin_user, Customer, Loan, LoanSchedule, Payment, counters):
    import secrets
    from dateutil.relativedelta import relativedelta

    cedula = row['cedula']
    customer = Customer.objects.filter(id_number=cedula).first()
    if not customer:
        # Generar customer_code unico (el save() del modelo concreto no se ejecuta en migraciones)
        while True:
            cust_code = 'CLI' + ''.join(secrets.choice('0123456789') for _ in range(8))
            if not Customer.objects.filter(customer_code=cust_code).exists():
                break
        customer = Customer.objects.create(
            customer_code=cust_code,
            first_name=(row['first_name'] or 'Cliente')[:50],
            last_name=(row['last_name'] or 'Sin Apellido')[:50],
            id_number=cedula, id_type='CEDULA',
            phone1=(row['phone'] or '')[:20],
            address=(row['address'] or '')[:200],
            gender='M', customer_type='NATURAL', status='ACTIVE',
            country='Republica Dominicana', branch=branch,
            nationality='Dominicano/a',
        )
        counters['customers'] += 1

    amount = Decimal(str(row['amount']))
    loan_date = date.fromisoformat(row['loan_date'])

    if Loan.objects.filter(customer=customer, principal_amount=amount, disbursement_date=loan_date).exists():
        counters['skipped'] += 1
        return

    cuota = Decimal(str(row['monthly_payment'])) if row['monthly_payment'] else amount
    plazo = max(1, int(row['term_months']))
    total_to_pay = cuota * plazo
    total_interest = total_to_pay - amount
    if total_interest < 0:
        total_interest = Decimal('0')

    annual_rate = Decimal('0')
    if amount > 0:
        annual_rate = (total_interest / amount * Decimal('12') / plazo * 100).quantize(Decimal('0.001'))
    if annual_rate < 0:
        annual_rate = Decimal('0')
    if annual_rate > Decimal('999.999'):
        annual_rate = Decimal('999.999')

    maturity = loan_date + relativedelta(months=plazo)
    first_pay = date.fromisoformat(row['first_payment_date']) if row['first_payment_date'] else maturity

    while True:
        loan_number = 'PRE' + ''.join(secrets.choice('0123456789') for _ in range(8))
        if not Loan.objects.filter(loan_number=loan_number).exists():
            break

    loan = Loan.objects.create(
        loan_number=loan_number,
        customer=customer, product=product, branch=branch,
        principal_amount=amount, outstanding_principal=amount,
        annual_interest_rate=annual_rate, term_months=plazo,
        payment_method='NIVELADA', payment_frequency='MONTHLY', interest_type='SIMPLE',
        total_installments=plazo, monthly_payment=cuota.quantize(Decimal('0.01')),
        total_interest=total_interest.quantize(Decimal('0.01')),
        total_to_pay=total_to_pay.quantize(Decimal('0.01')),
        disbursement_date=loan_date, first_payment_date=first_pay, maturity_date=maturity,
        status='ACTIVE',
        notes='Importado desde Excel. Garantia: ' + (row.get('guarantee') or ''),
    )
    counters['loans'] += 1

    interest_per = total_interest / plazo
    principal_per = amount / plazo
    for i in range(1, plazo + 1):
        due = first_pay + relativedelta(months=i - 1)
        balance = amount - principal_per * i
        LoanSchedule.objects.create(
            loan=loan, installment_number=i, due_date=due,
            principal_amount=principal_per.quantize(Decimal('0.01')),
            interest_amount=interest_per.quantize(Decimal('0.01')),
            total_amount=cuota.quantize(Decimal('0.01')),
            balance_after=balance.quantize(Decimal('0.01')) if balance > 0 else Decimal('0'),
            status='PENDING',
        )

    paid_count = int(row.get('paid_installments') or 0)
    if paid_count > 0 and admin_user is not None:
        last_pay_date = date.fromisoformat(row['last_payment_date']) if row['last_payment_date'] else first_pay
        for i in range(1, paid_count + 1):
            sched = loan.schedule.filter(installment_number=i).first()
            if not sched:
                continue
            while True:
                pay_num = 'PAG' + ''.join(secrets.choice('0123456789') for _ in range(8))
                if not Payment.objects.filter(payment_number=pay_num).exists():
                    break
            while True:
                rec_num = 'REC' + ''.join(secrets.choice('0123456789') for _ in range(8))
                if not Payment.objects.filter(receipt_number=rec_num).exists():
                    break
            Payment.objects.create(
                payment_number=pay_num, receipt_number=rec_num,
                customer=customer, loan=loan,
                total_amount=cuota.quantize(Decimal('0.01')),
                principal_amount=Decimal(str(sched.principal_amount)),
                interest_amount=Decimal(str(sched.interest_amount)),
                late_fee_amount=Decimal('0'),
                payment_method='CASH', payment_type='REGULAR',
                payment_date=last_pay_date, status='CONFIRMED',
                received_by=admin_user,
                notes='Importado desde Excel (cuota previamente pagada)',
            )
            sched.total_paid = cuota
            sched.paid_date = last_pay_date
            sched.status = 'PAID'
            sched.save()
            counters['payments'] += 1

        effective_paid = min(paid_count, plazo)
        loan.installments_paid = effective_paid
        loan.installments_remaining = max(0, plazo - effective_paid)
        loan.outstanding_principal = max(Decimal('0'), amount - (amount / plazo * effective_paid))
        loan.total_paid = cuota * effective_paid
        loan.last_payment_date = last_pay_date
        if loan.outstanding_principal <= Decimal('0.01'):
            loan.status = 'COMPLETED'
        loan.save()


def reverse_seed(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('loans', '0008_loan_check_constraints'),
        ('customers', '0001_initial'),
        ('payments', '0001_initial'),
        ('branches', '0002_initial'),
        ('loan_products', '0004_seed_default_products'),
        ('users', '0001_initial'),
    ]
    operations = [
        migrations.RunPython(seed_existing_loans, reverse_seed),
    ]
