from sqlalchemy.orm import Session
from datetime import datetime
from decimal import Decimal
from app import models

class OfferService:
    @staticmethod
    def generate_offer_number(db: Session, user: models.User) -> str:
        year = datetime.now().year
        
        # Lock the sequence row for update to prevent race conditions
        # Using with_for_update()
        sequence = db.query(models.OfferSequence).filter(
            models.OfferSequence.user_id == user.id,
            models.OfferSequence.year == year
        ).with_for_update().first()
        
        if not sequence:
            sequence = models.OfferSequence(user_id=user.id, year=year, next_sequence=1)
            db.add(sequence)
            db.flush() # Flush to get ID if needed, but we need it locked. 
            # Actually if we just inserted, we hold the lock on the new row in this transaction.
            
        seq_num = sequence.next_sequence
        sequence.next_sequence += 1
        db.add(sequence) # Mark as modified
        
        # Format: {USER_CODE}-{YYYY}-{SEQ}
        # SEQ is 4 digits zero padded
        return f"{user.user_code}-{year}-{seq_num:04d}"

    @staticmethod
    def calculate_margin(cost: Decimal, price: Decimal) -> tuple[Decimal, Decimal]:
        """
        Returns (margin_value, margin_percent)
        margin_value = price - cost
        margin_percent = (margin_value / price) * 100
        """
        if price == 0:
            return Decimal(0), Decimal(0)
            
        margin_value = price - cost
        margin_percent = (margin_value / price) * 100
        return margin_value, margin_percent

    @staticmethod
    def calculate_price_from_margin(cost: Decimal, margin_percent: Decimal) -> Decimal:
        """
        price = cost / (1 - margin_percent/100)
        """
        if margin_percent >= 100:
            # Avoid division by zero or negative price if margin is >= 100% (impossible for this formula usually unless cost is negative)
            # But mathematically if margin is 100%, price is infinite.
            # Let's cap or raise error. For now, return cost (0 margin) if invalid?
            # Or maybe just return a very high number?
            # Let's assume valid input < 100.
            return cost # Fallback
            
        if margin_percent < 0:
             # Negative margin is possible (selling below cost)
             pass
             
        price = cost / (Decimal(1) - (margin_percent / Decimal(100)))
        return price

    @staticmethod
    def recalculate_offer_totals(db: Session, offer: models.Offer):
        # Re-fetch lines to ensure we have latest
        db.refresh(offer)
        
        total_cost = Decimal(0)
        total_price = Decimal(0)
        apply_discount = bool(getattr(offer, "show_discount_column", False))
        
        for line in offer.lines:
            qty = line.quantity
            total_cost += line.cost * qty
            effective_price = line.price
            try:
                discount = Decimal(line.discount_percent or 0)
            except Exception:
                discount = Decimal(0)
            if not apply_discount:
                discount = Decimal(0)
            if discount != 0:
                effective_price = line.price * (Decimal(1) - discount / Decimal(100))
            total_price += effective_price * qty
            
        offer.total_cost = total_cost
        offer.total_price = total_price
        
        if total_price != 0:
            offer.total_margin_value = total_price - total_cost
            offer.total_margin_percent = (offer.total_margin_value / total_price) * 100
        else:
            offer.total_margin_value = 0
            offer.total_margin_percent = 0
            
        db.add(offer)
        # We don't commit here, let caller commit
