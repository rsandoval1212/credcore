"""
Generación de PDFs para CredCore:
- Recibo de pago
- Contrato de préstamo
- Tabla de amortización
- Estado de cuenta del cliente
"""
import io
from datetime import date
from decimal import Decimal

from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated


def _get_company():
    from apps.core.models import CompanySettings
    return CompanySettings.get_solo()


def _pdf_response(buffer: io.BytesIO, filename: str) -> HttpResponse:
    buffer.seek(0)
    response = HttpResponse(buffer.read(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def _fmt(n) -> str:
    if n is None:
        return 'RD$0.00'
    return f"RD$ {float(n):,.2f}"


def _fdate(d) -> str:
    if not d:
        return '—'
    if hasattr(d, 'strftime'):
        return d.strftime('%d/%m/%Y')
    return str(d)


# ── Estilos compartidos ────────────────────────────────────────────────────────
def _base_styles():
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

    styles = getSampleStyleSheet()
    DARK = colors.HexColor('#1E3A5F')
    BLUE = colors.HexColor('#2563EB')
    GRAY = colors.HexColor('#6B7280')
    LIGHT = colors.HexColor('#F3F4F6')

    custom = {
        'title':     ParagraphStyle('title',    parent=styles['Normal'], fontSize=18, fontName='Helvetica-Bold', textColor=DARK, spaceAfter=4),
        'subtitle':  ParagraphStyle('subtitle', parent=styles['Normal'], fontSize=10, fontName='Helvetica',      textColor=GRAY, spaceAfter=12),
        'h2':        ParagraphStyle('h2',       parent=styles['Normal'], fontSize=12, fontName='Helvetica-Bold', textColor=DARK, spaceAfter=6, spaceBefore=10),
        'body':      ParagraphStyle('body',     parent=styles['Normal'], fontSize=9,  fontName='Helvetica',      textColor=colors.black, spaceAfter=3, leading=14),
        'small':     ParagraphStyle('small',    parent=styles['Normal'], fontSize=8,  fontName='Helvetica',      textColor=GRAY),
        'center':    ParagraphStyle('center',   parent=styles['Normal'], fontSize=9,  fontName='Helvetica',      alignment=TA_CENTER),
        'right':     ParagraphStyle('right',    parent=styles['Normal'], fontSize=9,  fontName='Helvetica',      alignment=TA_RIGHT),
        'bold':      ParagraphStyle('bold',     parent=styles['Normal'], fontSize=9,  fontName='Helvetica-Bold'),
        'footer':    ParagraphStyle('footer',   parent=styles['Normal'], fontSize=7,  fontName='Helvetica',      textColor=GRAY, alignment=TA_CENTER),
    }
    return custom, DARK, BLUE, GRAY, LIGHT, colors


def _company_logo_flowable(company, max_h=1.5):
    """Devuelve un flowable Image con el logo de la empresa configurado en
    Configuración, escalado a una altura máxima (cm), o None si no hay logo
    legible. Marca blanca: cada empresa imprime su propio logo.

    El logo se reduce con PIL a máx 400px antes de incrustarlo; si no, un logo
    de varios MB inflaría cada documento (recibos, estados) y dificultaría
    compartirlos por WhatsApp/correo.
    """
    import os, io as _io
    from reportlab.platypus import Image
    from reportlab.lib.units import cm
    try:
        logo = getattr(company, 'logo', None)
        path = logo.path if logo else None
        if not path or not os.path.exists(path):
            return None
        try:
            from PIL import Image as PILImage
            pim = PILImage.open(path)
            pim.thumbnail((400, 400))
            if pim.mode in ('RGBA', 'P', 'LA'):
                fmt, pim2 = 'PNG', pim.convert('RGBA')
            else:
                fmt, pim2 = 'JPEG', pim.convert('RGB')
            buf = _io.BytesIO()
            pim2.save(buf, format=fmt)
            buf.seek(0)
            img = Image(buf)
        except Exception:
            img = Image(path)  # sin PIL: incrustar original
        ratio = (img.imageWidth / img.imageHeight) if img.imageHeight else 1.0
        img.drawHeight = max_h * cm
        img.drawWidth = max_h * cm * ratio
        # Limitar ancho para que no invada el bloque de texto
        if img.drawWidth > 4.5 * cm:
            img.drawWidth = 4.5 * cm
            img.drawHeight = (4.5 * cm) / ratio if ratio else max_h * cm
        return img
    except Exception:
        return None


def _company_info_lines(company, s):
    """Líneas de texto con los datos de la empresa configurada (nombre + contacto)."""
    from reportlab.platypus import Paragraph
    lines = [Paragraph(company.company_name.upper(), s['title'])]
    bits = []
    if getattr(company, 'tax_id', ''):
        bits.append(f"RNC: {company.tax_id}")
    if company.address:
        bits.append(company.address.replace('\n', ' '))
    tels = [t for t in [company.phone, getattr(company, 'phone2', '')] if t]
    if tels:
        bits.append('Tel: ' + ' / '.join(tels))
    if company.email:
        bits.append(company.email)
    if getattr(company, 'website', ''):
        bits.append(company.website)
    for b in bits:
        lines.append(Paragraph(b, s['small']))
    return lines


def _header_block(elements, company, title: str, subtitle: str = '', styles=None):
    """Bloque de encabezado (membrete) con el LOGO y los datos de la empresa
    configurada en Configuración + título del documento. Compartido por todos
    los PDFs (recibo, contrato, amortización, estado) → marca blanca uniforme."""
    from reportlab.platypus import Paragraph, Spacer, HRFlowable, Table, TableStyle
    from reportlab.lib.units import cm

    s, DARK, BLUE, GRAY, LIGHT, c = styles or _base_styles()

    info_lines = _company_info_lines(company, s)
    logo = _company_logo_flowable(company)

    if logo is not None:
        # Membrete: logo a la izquierda, datos de la empresa a la derecha
        head = Table([[logo, info_lines]], colWidths=[5 * cm, None])
        head.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(head)
    else:
        for ln in info_lines:
            elements.append(ln)

    elements.append(HRFlowable(width='100%', thickness=2, color=DARK, spaceAfter=8))
    elements.append(Paragraph(title, s['h2']))
    if subtitle:
        elements.append(Paragraph(subtitle, s['small']))
    elements.append(Spacer(1, 6))


def _footer_text(company):
    today = date.today().strftime('%d/%m/%Y')
    return f"{company.company_name}  •  {company.phone or ''}  •  {today}  •  Documento generado automáticamente"


def _footer_canvas(company):
    """Callback que dibuja el pie (datos de la empresa configurada) en el borde
    inferior de CADA página, sin ocupar el flujo de contenido (así nunca genera
    una página extra). Se pasa a doc.build(onFirstPage=..., onLaterPages=...)."""
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    text = _footer_text(company)

    def _draw(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(colors.HexColor('#6B7280'))
        canvas.drawCentredString(doc.pagesize[0] / 2.0, 1.0 * cm, text)
        canvas.restoreState()

    return _draw


# ── RECIBO DE PAGO ─────────────────────────────────────────────────────────────
class PaymentReceiptPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, payment_id):
        from apps.payments.models import Payment
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm

        try:
            payment = Payment.objects.select_related('loan', 'customer', 'received_by').get(id=payment_id)
        except Payment.DoesNotExist:
            from rest_framework.response import Response
            return Response({'detail': 'Pago no encontrado.'}, status=404)

        company = _get_company()
        sym     = company.currency_symbol or 'RD$'

        buf  = io.BytesIO()
        doc  = SimpleDocTemplate(buf, pagesize=A4,
                                 leftMargin=2*cm, rightMargin=2*cm,
                                 topMargin=2*cm, bottomMargin=2*cm)
        styles, DARK, BLUE, GRAY, LIGHT, c = _base_styles()
        elements = []

        _header_block(elements, company,
                      f'RECIBO DE PAGO',
                      f'Recibo N°: {payment.receipt_number}',
                      (styles, DARK, BLUE, GRAY, LIGHT, c))

        # Datos del cliente
        elements.append(Paragraph('Datos del Cliente', styles['h2']))
        client_data = [
            ['Cliente:', payment.customer.get_full_name() if payment.customer else '—'],
            ['Cédula:', payment.customer.id_number if payment.customer else '—'],
            ['Teléfono:', payment.customer.phone1 if payment.customer else '—'],
        ]
        t = Table(client_data, colWidths=[4*cm, 12*cm])
        t.setStyle(TableStyle([
            ('FONTNAME',    (0,0), (-1,-1), 'Helvetica'),
            ('FONTNAME',    (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTSIZE',    (0,0), (-1,-1), 9),
            ('TEXTCOLOR',   (0,0), (0,-1), colors.HexColor('#1E3A5F')),
            ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.white, colors.HexColor('#F9FAFB')]),
            ('BOTTOMPADDING',(0,0), (-1,-1), 5),
            ('TOPPADDING',  (0,0), (-1,-1), 5),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 10))

        # Datos del pago
        elements.append(Paragraph('Detalle del Pago', styles['h2']))
        pay_data = [
            ['Préstamo N°:',   payment.loan.loan_number if payment.loan else '—',  'Fecha de Pago:', _fdate(payment.payment_date)],
            ['Tipo de Pago:',  payment.get_payment_type_display(),                  'Método:',        payment.get_payment_method_display()],
            ['Capital:',       _fmt(payment.principal_amount),                      'Interés:',       _fmt(payment.interest_amount)],
            ['Mora:',          _fmt(payment.late_fee_amount),                       'Recibido por:',  payment.received_by.get_full_name() if payment.received_by else '—'],
        ]
        t2 = Table(pay_data, colWidths=[4*cm, 6*cm, 4*cm, 6*cm])
        t2.setStyle(TableStyle([
            ('FONTNAME',    (0,0), (-1,-1), 'Helvetica'),
            ('FONTNAME',    (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTNAME',    (2,0), (2,-1), 'Helvetica-Bold'),
            ('FONTSIZE',    (0,0), (-1,-1), 9),
            ('TEXTCOLOR',   (0,0), (0,-1), DARK),
            ('TEXTCOLOR',   (2,0), (2,-1), DARK),
            ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.white, colors.HexColor('#F9FAFB')]),
            ('BOTTOMPADDING',(0,0), (-1,-1), 5),
            ('TOPPADDING',  (0,0), (-1,-1), 5),
        ]))
        elements.append(t2)
        elements.append(Spacer(1, 16))

        # Total destacado
        total_data = [['TOTAL PAGADO', f"{sym} {float(payment.total_amount):,.2f}"]]
        t3 = Table(total_data, colWidths=[10*cm, 10*cm])
        t3.setStyle(TableStyle([
            ('BACKGROUND',   (0,0), (-1,-1), DARK),
            ('TEXTCOLOR',    (0,0), (-1,-1), colors.white),
            ('FONTNAME',     (0,0), (-1,-1), 'Helvetica-Bold'),
            ('FONTSIZE',     (0,0), (0,-1), 12),
            ('FONTSIZE',     (1,0), (1,-1), 16),
            ('ALIGN',        (0,0), (0,-1), 'LEFT'),
            ('ALIGN',        (1,0), (1,-1), 'RIGHT'),
            ('BOTTOMPADDING',(0,0), (-1,-1), 10),
            ('TOPPADDING',   (0,0), (-1,-1), 10),
            ('LEFTPADDING',  (0,0), (-1,-1), 12),
            ('RIGHTPADDING', (0,0), (-1,-1), 12),
            ('ROUNDEDCORNERS', [6]),
        ]))
        elements.append(t3)
        elements.append(Spacer(1, 20))

        # Firma
        firma_data = [
            ['_________________________', '_________________________'],
            ['Firma del Cliente', 'Firma del Cajero/Cobrador'],
        ]
        t4 = Table(firma_data, colWidths=[10*cm, 10*cm])
        t4.setStyle(TableStyle([
            ('FONTNAME',  (0,0), (-1,-1), 'Helvetica'),
            ('FONTSIZE',  (0,0), (-1,-1), 9),
            ('ALIGN',     (0,0), (-1,-1), 'CENTER'),
            ('TEXTCOLOR', (0,1), (-1,1), GRAY),
            ('TOPPADDING',(0,1), (-1,1), 2),
        ]))
        elements.append(t4)
        elements.append(Spacer(1, 20))

        # Footer
        if company.receipt_footer:
            elements.append(HRFlowable(width='100%', thickness=1, color=GRAY))
            elements.append(Spacer(1, 4))
            elements.append(Paragraph(company.receipt_footer, styles['footer']))

        _fcb = _footer_canvas(company)
        doc.build(elements, onFirstPage=_fcb, onLaterPages=_fcb)
        return _pdf_response(buf, f'recibo_{payment.receipt_number}.pdf')


# ── TABLA DE AMORTIZACIÓN PDF ─────────────────────────────────────────────────
class AmortizationPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, loan_id):
        from apps.loans.models import Loan, LoanSchedule
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from reportlab.lib.units import cm

        try:
            loan = Loan.objects.select_related('customer', 'product', 'branch').get(id=loan_id)
        except Loan.DoesNotExist:
            from rest_framework.response import Response
            return Response({'detail': 'Préstamo no encontrado.'}, status=404)

        schedule = LoanSchedule.objects.filter(loan=loan).order_by('installment_number')
        company  = _get_company()

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
                                leftMargin=1.5*cm, rightMargin=1.5*cm,
                                topMargin=1.5*cm, bottomMargin=1.5*cm)
        styles, DARK, BLUE, GRAY, LIGHT, c = _base_styles()
        elements = []

        _header_block(elements, company,
                      f'TABLA DE AMORTIZACIÓN — {loan.loan_number}',
                      '',
                      (styles, DARK, BLUE, GRAY, LIGHT, c))

        # ── Datos del cliente y del préstamo (a quién corresponde la tabla) ──────
        cust = loan.customer
        _addr = ', '.join(p for p in [
            getattr(cust, 'address', '') or '',
            getattr(cust, 'sector', '') or '',
            getattr(cust, 'municipality', '') or '',
            getattr(cust, 'province', '') or '',
        ] if p) or '—'
        _tel = cust.phone1 or getattr(cust, 'whatsapp', '') or '—'
        # Envolver valores potencialmente largos en Paragraph para que ajusten
        # dentro de su celda en vez de encimarse con la columna derecha.
        _addr_p = Paragraph(_addr, styles['body'])
        _prod_p = Paragraph(loan.product.name if loan.product else '—', styles['body'])
        info = [
            ['Cliente:',   Paragraph(cust.get_full_name(), styles['body']), 'Préstamo N°:',    loan.loan_number],
            ['Cédula/ID:', cust.id_number or '—',                           'Producto:',       _prod_p],
            ['Teléfono:',  _tel,                                             'Código cliente:', cust.customer_code or '—'],
            ['Dirección:', _addr_p,                                          'Tasa / Plazo:',   f'{loan.annual_interest_rate}% anual · {loan.term_months} meses'],
        ]
        t_info = Table(info, colWidths=[3*cm, 8.5*cm, 3.5*cm, 6.5*cm])
        t_info.setStyle(TableStyle([
            ('FONTNAME',  (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTNAME',  (2,0), (2,-1), 'Helvetica-Bold'),
            ('FONTNAME',  (1,0), (1,-1), 'Helvetica'),
            ('FONTNAME',  (3,0), (3,-1), 'Helvetica'),
            ('FONTSIZE',  (0,0), (-1,-1), 9),
            ('TEXTCOLOR', (0,0), (0,-1), DARK),
            ('TEXTCOLOR', (2,0), (2,-1), DARK),
            ('VALIGN',    (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('TOPPADDING',    (0,0), (-1,-1), 3),
            ('LINEBELOW', (0,-1), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ]))
        elements.append(t_info)
        elements.append(Spacer(1, 6))

        # Resumen
        resumen = [
            ['Capital:', _fmt(loan.principal_amount), 'Cuota mensual:', _fmt(loan.monthly_payment)],
            ['Total intereses:', _fmt(loan.total_interest), 'Total a pagar:', _fmt(loan.total_to_pay)],
            ['Desembolso:', _fdate(loan.disbursement_date), 'Vencimiento:', _fdate(loan.maturity_date)],
        ]
        t_res = Table(resumen, colWidths=[4*cm, 6*cm, 4*cm, 6*cm])
        t_res.setStyle(TableStyle([
            ('FONTNAME',  (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTNAME',  (2,0), (2,-1), 'Helvetica-Bold'),
            ('FONTNAME',  (1,0), (-1,-1), 'Helvetica'),
            ('FONTSIZE',  (0,0), (-1,-1), 9),
            ('TEXTCOLOR', (0,0), (0,-1), DARK),
            ('TEXTCOLOR', (2,0), (2,-1), DARK),
            ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.white, colors.HexColor('#F3F4F6')]),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING',    (0,0), (-1,-1), 4),
        ]))
        elements.append(t_res)
        elements.append(Spacer(1, 12))

        # Tabla de cuotas
        STATUS_LABELS = {
            'PAID': 'Pagada', 'PARTIAL': 'Parcial', 'PENDING': 'Pendiente',
            'OVERDUE': 'Vencida', 'WAIVED': 'Condonada',
        }
        STATUS_COLORS = {
            'PAID':    colors.HexColor('#D1FAE5'),
            'PARTIAL': colors.HexColor('#FEF3C7'),
            'OVERDUE': colors.HexColor('#FEE2E2'),
            'PENDING': colors.white,
            'WAIVED':  colors.HexColor('#EFF6FF'),
        }

        headers = ['#', 'Vencimiento', 'Capital', 'Interés', 'Cuota', 'Pagado', 'Saldo', 'Estado']
        data = [headers]
        for row in schedule:
            is_over = row.is_overdue
            st = 'OVERDUE' if is_over else row.status
            data.append([
                str(row.installment_number),
                _fdate(row.due_date),
                f"{float(row.principal_amount):,.2f}",
                f"{float(row.interest_amount):,.2f}",
                f"{float(row.total_amount):,.2f}",
                f"{float(row.total_paid):,.2f}" if row.total_paid else '—',
                f"{float(row.balance_after):,.2f}",
                STATUS_LABELS.get(st, st),
            ])

        # Totales
        data.append([
            'TOTAL', '',
            f"{sum(float(r.principal_amount) for r in schedule):,.2f}",
            f"{sum(float(r.interest_amount) for r in schedule):,.2f}",
            f"{sum(float(r.total_amount) for r in schedule):,.2f}",
            f"{sum(float(r.total_paid) for r in schedule):,.2f}",
            '', '',
        ])

        col_w = [1.2*cm, 3*cm, 3.5*cm, 3.5*cm, 3.5*cm, 3.5*cm, 3.5*cm, 2.8*cm]
        t_sched = Table(data, colWidths=col_w, repeatRows=1)

        row_styles = [
            ('BACKGROUND',   (0,0), (-1,0), DARK),
            ('TEXTCOLOR',    (0,0), (-1,0), colors.white),
            ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTNAME',     (0,1), (-1,-1), 'Helvetica'),
            ('FONTSIZE',     (0,0), (-1,-1), 8),
            ('ALIGN',        (2,0), (-1,-1), 'RIGHT'),
            ('ALIGN',        (0,0), (1,-1), 'CENTER'),
            ('GRID',         (0,0), (-1,-1), 0.3, colors.HexColor('#E5E7EB')),
            ('ROWBACKGROUNDS',(0,1), (-1,-2), [colors.white, colors.HexColor('#F9FAFB')]),
            ('BACKGROUND',   (0,-1), (-1,-1), colors.HexColor('#EFF6FF')),
            ('FONTNAME',     (0,-1), (-1,-1), 'Helvetica-Bold'),
            ('BOTTOMPADDING',(0,0), (-1,-1), 2),
            ('TOPPADDING',   (0,0), (-1,-1), 2),
        ]
        # Colorear por estado
        for i, row in enumerate(schedule, 1):
            st = 'OVERDUE' if row.is_overdue else row.status
            bg = STATUS_COLORS.get(st, colors.white)
            if bg != colors.white:
                row_styles.append(('BACKGROUND', (0, i), (-1, i), bg))

        t_sched.setStyle(TableStyle(row_styles))
        elements.append(t_sched)

        _fcb = _footer_canvas(company)
        doc.build(elements, onFirstPage=_fcb, onLaterPages=_fcb)
        return _pdf_response(buf, f'amortizacion_{loan.loan_number}.pdf')


# ── CONTRATO DE PRÉSTAMO PDF ──────────────────────────────────────────────────
class LoanContractPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, loan_id):
        from apps.loans.models import Loan
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm

        try:
            loan = Loan.objects.select_related('customer', 'product', 'branch', 'officer').get(id=loan_id)
        except Loan.DoesNotExist:
            from rest_framework.response import Response
            return Response({'detail': 'Préstamo no encontrado.'}, status=404)

        company = _get_company()
        cust    = loan.customer
        sym     = company.currency_symbol or 'RD$'

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
                                leftMargin=2.5*cm, rightMargin=2.5*cm,
                                topMargin=2*cm, bottomMargin=2*cm)
        styles, DARK, BLUE, GRAY, LIGHT, c = _base_styles()
        elements = []

        # Encabezado
        _header_block(elements, company,
                      'CONTRATO DE PRÉSTAMO',
                      f'Contrato N°: {loan.loan_number}  |  Fecha: {_fdate(loan.disbursement_date)}',
                      (styles, DARK, BLUE, GRAY, LIGHT, c))

        # Cuerpo legal
        nombre_empresa = company.company_name
        nombre_cliente = cust.get_full_name() if cust else '—'
        cedula_cliente = cust.id_number if cust else '—'
        dir_cliente    = cust.address if cust else '—'
        monto_str      = f"{sym} {float(loan.principal_amount):,.2f}"
        tasa_str       = f"{float(loan.annual_interest_rate):.2f}% anual"
        plazo_str      = f"{loan.term_months} meses"
        cuota_str      = f"{sym} {float(loan.monthly_payment):,.2f}"
        mora_str       = f"{float(loan.late_fee_rate):.2f}% diario"
        frecuencia     = getattr(loan, 'get_payment_frequency_display', lambda: 'Mensual')()

        intro = (
            f"En la ciudad de {company.city or 'Santo Domingo'}, República Dominicana, "
            f"a los {_fdate(loan.disbursement_date)}, entre <b>{nombre_empresa}</b> "
            f"(en adelante EL PRESTAMISTA), y <b>{nombre_cliente}</b>, portador de la "
            f"cédula de identidad N° <b>{cedula_cliente}</b>, con domicilio en {dir_cliente} "
            f"(en adelante EL PRESTATARIO), se celebra el siguiente contrato de préstamo:"
        )
        elements.append(Paragraph(intro, styles['body']))
        elements.append(Spacer(1, 10))

        clauses = [
            ('PRIMERA: MONTO DEL PRÉSTAMO',
             f"EL PRESTAMISTA entrega en calidad de préstamo la suma de <b>{monto_str}</b> "
             f"que EL PRESTATARIO declara recibir a su entera satisfacción."),
            ('SEGUNDA: TASA DE INTERÉS',
             f"El préstamo devengará una tasa de interés de <b>{tasa_str}</b> ({float(loan.annual_interest_rate)/12:.4f}% mensual), "
             f"calculado sobre el saldo insoluto. Método: {loan.get_payment_method_display() if hasattr(loan, 'get_payment_method_display') else 'Cuotas Niveladas'}."),
            ('TERCERA: PLAZO Y FORMA DE PAGO',
             f"El préstamo tiene un plazo de <b>{plazo_str}</b>, pagadero en cuotas {frecuencia.lower()}s de "
             f"<b>{cuota_str}</b> cada una. La primera cuota vence el <b>{_fdate(loan.first_payment_date)}</b>."),
            ('CUARTA: MORA E INTERÉS MORATORIO',
             f"En caso de incumplimiento, EL PRESTATARIO pagará un interés moratorio de <b>{mora_str}</b> "
             f"sobre el monto vencido, además de los gastos de cobro que se originen."),
            ('QUINTA: VENCIMIENTO ANTICIPADO',
             "EL PRESTAMISTA podrá exigir el pago anticipado del capital e intereses en caso de mora "
             "superior a 30 días, deterioro comprobable de la situación financiera del prestatario, "
             "o incumplimiento de cualquier cláusula de este contrato."),
            ('SEXTA: DOMICILIO Y JURISDICCIÓN',
             f"Las partes fijan su domicilio en {company.city or 'Santo Domingo'} y se someten a la "
             "jurisdicción de los tribunales competentes de la República Dominicana."),
        ]

        for title, text in clauses:
            elements.append(Paragraph(title, styles['h2']))
            elements.append(Paragraph(text, styles['body']))
            elements.append(Spacer(1, 6))

        # Nota legal
        if company.legal_notice:
            elements.append(HRFlowable(width='100%', thickness=1, color=GRAY))
            elements.append(Spacer(1, 4))
            elements.append(Paragraph(company.legal_notice, styles['small']))

        elements.append(Spacer(1, 20))

        # Firmas
        firma_data = [
            ['_________________________', '_________________________'],
            [nombre_empresa,              nombre_cliente],
            ['El Prestamista',            'El Prestatario'],
            [f"RNC: {company.tax_id or '---'}",   f"Cédula: {cedula_cliente}"],
        ]
        t_firma = Table(firma_data, colWidths=[9*cm, 9*cm])
        t_firma.setStyle(TableStyle([
            ('FONTNAME',  (0,0), (-1,-1), 'Helvetica'),
            ('FONTNAME',  (0,1), (-1,2), 'Helvetica-Bold'),
            ('FONTSIZE',  (0,0), (-1,-1), 9),
            ('TEXTCOLOR', (0,1), (-1,2), DARK),
            ('TEXTCOLOR', (0,3), (-1,3), GRAY),
            ('ALIGN',     (0,0), (-1,-1), 'CENTER'),
            ('TOPPADDING',(0,1), (-1,-1), 2),
        ]))
        elements.append(t_firma)

        _fcb = _footer_canvas(company)
        doc.build(elements, onFirstPage=_fcb, onLaterPages=_fcb)
        return _pdf_response(buf, f'contrato_{loan.loan_number}.pdf')


# ── ESTADO DE CUENTA PDF ──────────────────────────────────────────────────────
class AccountStatementPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, loan_id):
        from apps.loans.models import Loan, LoanSchedule
        from apps.payments.models import Payment
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm

        try:
            loan = Loan.objects.select_related('customer', 'product').get(id=loan_id)
        except Loan.DoesNotExist:
            from rest_framework.response import Response
            return Response({'detail': 'Préstamo no encontrado.'}, status=404)

        company  = _get_company()
        sym      = company.currency_symbol or 'RD$'
        payments = Payment.objects.filter(loan=loan, status='CONFIRMED').order_by('payment_date')
        schedule = LoanSchedule.objects.filter(loan=loan).order_by('installment_number')
        today    = date.today()

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4,
                                leftMargin=2*cm, rightMargin=2*cm,
                                topMargin=2*cm, bottomMargin=2*cm)
        styles, DARK, BLUE, GRAY, LIGHT, c = _base_styles()
        elements = []

        _header_block(elements, company,
                      'ESTADO DE CUENTA',
                      f'Préstamo: {loan.loan_number}  |  Generado: {_fdate(today)}',
                      (styles, DARK, BLUE, GRAY, LIGHT, c))

        # Datos del cliente
        cust = loan.customer
        elements.append(Paragraph('Datos del Titular', styles['h2']))
        cust_data = [
            ['Cliente:', cust.get_full_name() if cust else '—', 'Cédula:', cust.id_number if cust else '—'],
            ['Teléfono:', cust.phone1 if cust else '—', 'Email:', cust.email if cust else '—'],
        ]
        t1 = Table(cust_data, colWidths=[3.5*cm, 7*cm, 3*cm, 5.5*cm])
        t1.setStyle(TableStyle([
            ('FONTNAME',  (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTNAME',  (2,0), (2,-1), 'Helvetica-Bold'),
            ('FONTNAME',  (1,0), (-1,-1), 'Helvetica'),
            ('FONTSIZE',  (0,0), (-1,-1), 9),
            ('TEXTCOLOR', (0,0), (0,-1), DARK),
            ('TEXTCOLOR', (2,0), (2,-1), DARK),
            ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.white, colors.HexColor('#F9FAFB')]),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING',    (0,0), (-1,-1), 4),
        ]))
        elements.append(t1)
        elements.append(Spacer(1, 10))

        # Resumen del préstamo
        total_out = float(loan.outstanding_principal) + float(loan.outstanding_interest) + float(loan.outstanding_late_fees)
        elements.append(Paragraph('Resumen del Préstamo', styles['h2']))
        resumen = [
            ['Capital original:', _fmt(loan.principal_amount),   'Tasa anual:',    f"{float(loan.annual_interest_rate):.2f}%"],
            ['Total pagado:',     _fmt(loan.total_paid),          'Cuota mensual:', _fmt(loan.monthly_payment)],
            ['Saldo capital:',    _fmt(loan.outstanding_principal),'Saldo interés:', _fmt(loan.outstanding_interest)],
            ['Mora pendiente:',   _fmt(loan.outstanding_late_fees),'TOTAL PENDIENTE:', f"{'':0}{sym} {total_out:,.2f}"],
        ]
        t2 = Table(resumen, colWidths=[4*cm, 5*cm, 4*cm, 5.5*cm])
        t2.setStyle(TableStyle([
            ('FONTNAME',  (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTNAME',  (2,0), (2,-1), 'Helvetica-Bold'),
            ('FONTNAME',  (1,0), (-1,-1), 'Helvetica'),
            ('FONTSIZE',  (0,0), (-1,-1), 9),
            ('TEXTCOLOR', (0,0), (0,-1), DARK),
            ('TEXTCOLOR', (2,0), (2,-1), DARK),
            ('TEXTCOLOR', (1,3), (1,3), colors.HexColor('#059669')),
            ('TEXTCOLOR', (3,3), (3,3), colors.HexColor('#DC2626')),
            ('FONTNAME',  (1,3), (3,3), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0,0), (-1,-1), [colors.white, colors.HexColor('#F9FAFB')]),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('TOPPADDING',    (0,0), (-1,-1), 5),
        ]))
        elements.append(t2)
        elements.append(Spacer(1, 10))

        # Historial de pagos
        if payments.exists():
            elements.append(Paragraph(f'Historial de Pagos ({payments.count()} cobros)', styles['h2']))
            pay_headers = ['Recibo', 'Fecha', 'Capital', 'Interés', 'Mora', 'Total', 'Método']
            pay_rows = [pay_headers]
            for p in payments:
                pay_rows.append([
                    p.receipt_number,
                    _fdate(p.payment_date),
                    f"{float(p.principal_amount):,.2f}",
                    f"{float(p.interest_amount):,.2f}",
                    f"{float(p.late_fee_amount):,.2f}",
                    f"{float(p.total_amount):,.2f}",
                    p.get_payment_method_display(),
                ])
            # Totales
            pay_rows.append([
                'TOTAL', '',
                f"{sum(float(p.principal_amount) for p in payments):,.2f}",
                f"{sum(float(p.interest_amount) for p in payments):,.2f}",
                f"{sum(float(p.late_fee_amount) for p in payments):,.2f}",
                f"{sum(float(p.total_amount) for p in payments):,.2f}",
                '',
            ])
            t3 = Table(pay_rows, colWidths=[3.5*cm, 2.5*cm, 2.8*cm, 2.8*cm, 2.5*cm, 2.8*cm, 2.6*cm])
            t3.setStyle(TableStyle([
                ('BACKGROUND',   (0,0), (-1,0), DARK),
                ('TEXTCOLOR',    (0,0), (-1,0), colors.white),
                ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTNAME',     (0,1), (-1,-1), 'Helvetica'),
                ('FONTSIZE',     (0,0), (-1,-1), 8),
                ('ALIGN',        (2,0), (-1,-1), 'RIGHT'),
                ('GRID',         (0,0), (-1,-1), 0.3, colors.HexColor('#E5E7EB')),
                ('ROWBACKGROUNDS',(0,1), (-1,-2), [colors.white, colors.HexColor('#F9FAFB')]),
                ('BACKGROUND',   (0,-1), (-1,-1), colors.HexColor('#EFF6FF')),
                ('FONTNAME',     (0,-1), (-1,-1), 'Helvetica-Bold'),
                ('BOTTOMPADDING',(0,0), (-1,-1), 3),
                ('TOPPADDING',   (0,0), (-1,-1), 3),
            ]))
            elements.append(t3)

        elements.append(Spacer(1, 12))
        if company.statement_footer:
            elements.append(HRFlowable(width='100%', thickness=1, color=GRAY))
            elements.append(Paragraph(company.statement_footer, styles['footer']))

        _fcb = _footer_canvas(company)
        doc.build(elements, onFirstPage=_fcb, onLaterPages=_fcb)
        return _pdf_response(buf, f'estado_cuenta_{loan.loan_number}.pdf')
