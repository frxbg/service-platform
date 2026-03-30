from typing import Optional
from datetime import datetime
import os

from sqlalchemy.orm import Session
from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML

from app import models
from app.services.service_protocol_service import ServiceProtocolService


class PDFService:
    def __init__(self):
        template_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
        self.template_dir = template_dir
        self.env = Environment(
            loader=FileSystemLoader(template_dir),
            autoescape=select_autoescape(['html', 'xml']),
        )

    @staticmethod
    def _format_date(value: Optional[datetime]) -> str:
        if not value:
            return datetime.now().strftime('%d.%m.%Y')
        return value.strftime('%d.%m.%Y')

    def _line_total(self, line: models.OfferLine, apply_discount: bool) -> float:
        quantity = float(line.quantity or 0)
        price = float(line.price or 0)
        discount = float(getattr(line, "discount_percent", 0) or 0)
        if not apply_discount:
            discount = 0
        if discount:
            price = price * (1 - discount / 100)
        return round(price * quantity, 2)

    def generate_offer_pdf(self, db: Session, offer: models.Offer) -> bytes:
        """
        Generate PDF for an offer.
        Returns PDF as bytes.
        """
        db.refresh(offer)

        def line_type_value(line: models.OfferLine) -> str:
            raw_type = getattr(line, "type", "")
            return str(getattr(raw_type, "value", raw_type))

        material_lines = [
            line for line in offer.lines
            if line_type_value(line) in {"material", "service", "other"}
        ]
        labour_lines = [
            line for line in offer.lines
            if line_type_value(line) == "labour"
        ]

        apply_discount = bool(getattr(offer, "show_discount_column", False))
        parts_total = sum(self._line_total(line, apply_discount) for line in material_lines)
        labour_total = sum(self._line_total(line, apply_discount) for line in labour_lines)
        calculated_total = parts_total + labour_total

        total_without_vat = float(offer.total_price or calculated_total)
        vat_percent = 20
        vat_amount = round(total_without_vat * vat_percent / 100, 2)
        total_with_vat = round(total_without_vat + vat_amount, 2)

        fx_rate = 1.95583 if offer.currency == "BGN" else 1
        total_in_eur = round(total_with_vat / fx_rate, 2) if fx_rate else total_with_vat

        contact_person = getattr(offer, "contact_person", None)
        selected_contacts = list(getattr(offer, "contacts", []) or [])
        if not selected_contacts and contact_person is not None:
            selected_contacts = [contact_person]

        contact_names = [c.name for c in selected_contacts if getattr(c, "name", None)]
        if contact_names:
            client_contact = ", ".join(contact_names)
        else:
            contact_person_name = getattr(offer, "contact_person_name", None) or getattr(contact_person, "name", None)
            contact_person_email = getattr(contact_person, "email", None) or (offer.client.email if offer.client else None)
            contact_person_phone = getattr(contact_person, "phone", None) or (offer.client.phone if offer.client else None)
            client_contact = contact_person_name or contact_person_email or contact_person_phone or (offer.client.name if offer.client else "")

        global_salutation = (getattr(offer.client, "salutation_name", None) if offer.client else None) or None
        if global_salutation:
            client_contact_short = global_salutation
        elif len(selected_contacts) > 1:
            client_contact_short = (offer.client.name if offer.client else "") or "D§D¯D,DæD«¥,Dø"
        elif client_contact:
            client_contact_short = client_contact.split("@")[0]
        else:
            client_contact_short = (offer.client.name if offer.client else "") or "D§D¯D,DæD«¥,Dø"

        selected_site = getattr(offer, "site", None)
        if selected_site is None and offer.client:
            client_sites = list(getattr(offer.client, "sites", []) or [])
            for site in client_sites:
                if offer.project_name and (
                    site.site_code == offer.project_name
                    or site.site_name == offer.project_name
                    or site.project_number == offer.project_name
                ):
                    selected_site = site
                    break
            if selected_site is None and offer.site_address:
                for site in client_sites:
                    if site.address and site.address == offer.site_address:
                        selected_site = site
                        break

        site_code = getattr(selected_site, "site_code", None)
        site_name = getattr(selected_site, "site_name", None) or offer.project_name
        if site_code and site_name:
            offer_short_description = f"{site_code} - {site_name}"
        elif site_code:
            offer_short_description = site_code
        elif site_name:
            offer_short_description = site_name
        else:
            offer_short_description = offer.notes_client or "D¨¥?DæD'D¯D_DDæD«D,Dæ¥,D_"

        logo_path = os.path.join(self.template_dir, 'logo.png')
        logo_path = logo_path if os.path.exists(logo_path) else None

        wecare_logo_path = os.path.join(self.template_dir, 'wecare_logo.png')
        wecare_logo_path = wecare_logo_path if os.path.exists(wecare_logo_path) else None

        vinci_logo_path = os.path.join(self.template_dir, 'vinci_logo.png')
        vinci_logo_path = vinci_logo_path if os.path.exists(vinci_logo_path) else None

        # Fetch company settings from database
        company_settings = db.query(models.CompanySettings).first()
        if not company_settings:
            # Create default if not exists
            company_settings = models.CompanySettings(
                company_name="DoD_¥?¥,Dø DsD_D¬D¨DøD«D,¥?",
                company_address="",
                company_phone="",
                company_email="",
            )

        context = {
            'offer': offer,
            'client': offer.client,
            'user': offer.user,
            'material_lines': material_lines,
            'labour_lines': labour_lines,
            'show_discount_column': apply_discount,
            'parts_total': parts_total,
            'labour_total': labour_total,
            'total_without_vat': total_without_vat,
            'vat_percent': vat_percent,
            'vat_amount': vat_amount,
            'total_with_vat': total_with_vat,
            'fx_rate': fx_rate,
            'total_in_eur': total_in_eur,
            'offer_date': self._format_date(getattr(offer, "created_at", None)),
            'client_contact': client_contact,
            'client_contact_short': client_contact_short,
            'offer_short_description': offer_short_description,
            'currency': offer.currency,
            'warranty_text': '',
            'delivery_term_text': offer.delivery_time or '',
            'payment_terms_text': offer.payment_terms or '',
            'extra_info': offer.notes_client or '',
            'coolant_note': '',
            'author_name': offer.user.full_name or offer.user.email,
            'author_position': offer.user.position or '',
            'environment_paragraph_1': '',
            'environment_paragraph_2': '',
            'environment_paragraph_3': '',
            'generated_at': datetime.now().strftime('%d.%m.%Y %H:%M'),
            # Dynamic company settings
            'company_name': company_settings.company_name or 'DoD_¥?¥,Dø DsD_D¬D¨DøD«D,¥?',
            'company_address': company_settings.company_address or '',
            'company_phone': company_settings.company_phone or '',
            'company_email': company_settings.company_email or '',
            'company_footer_address': company_settings.company_address or '',
            'company_website': company_settings.company_website or '',
            'company_linkedin': '',
            'footer_text': company_settings.footer_text or '',
            'logo_path': logo_path,
            'wecare_logo_path': wecare_logo_path,
            'vinci_logo_path': vinci_logo_path,
        }

        template = self.env.get_template('offer_template.html')
        html_content = template.render(**context)

        pdf = HTML(string=html_content, base_url=self.template_dir).write_pdf()

        return pdf

    def generate_service_protocol_pdf(self, db: Session, request: models.ServiceRequest) -> bytes:
        db.refresh(request)
        protocol = ServiceProtocolService.build_preview(request)
        company_settings = db.query(models.CompanySettings).first()

        context = {
            "protocol": protocol,
            "company_name": getattr(company_settings, "company_name", "") or "Service Platform",
        }

        template = self.env.get_template("service_protocol_template.html")
        html_content = template.render(**context)
        return HTML(string=html_content, base_url=self.template_dir).write_pdf()
