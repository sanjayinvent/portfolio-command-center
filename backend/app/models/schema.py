from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base

class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    asset_type = Column(String(20), nullable=False, default="stock") # stock, etf, option, cash
    shares = Column(Float, nullable=False, default=0.0)
    cost_basis = Column(Float, nullable=False, default=0.0)
    market_price = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    options = relationship("OptionContract", back_populates="underlying")

class OptionContract(Base):
    __tablename__ = "option_contracts"

    id = Column(Integer, primary_key=True, index=True)
    holding_id = Column(Integer, ForeignKey("holdings.id"), nullable=True)
    symbol = Column(String(50), index=True, nullable=False)
    option_type = Column(String(10), nullable=False) # call, put
    strike = Column(Float, nullable=False)
    expiration_date = Column(String(20), nullable=False)
    quantity = Column(Float, nullable=False, default=1.0)
    cost_basis = Column(Float, nullable=False, default=0.0)
    current_price = Column(Float, nullable=False, default=0.0)

    underlying = relationship("Holding", back_populates="options")

class ApiConfig(Base):
    __tablename__ = "api_configs"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(50), unique=True, index=True, nullable=False) # schwab, yahoo
    app_key = Column(Text, nullable=True)
    app_secret = Column(Text, nullable=True)
    oauth_token = Column(Text, nullable=True)
    oauth_refresh_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
