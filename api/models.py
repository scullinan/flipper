# https://marshmallow.readthedocs.org/en/latest/examples.html#quotes-api-flask-sql-alchemy
import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from database import Base
from marshmallow import Schema, fields, ValidationError

# Custom validator
def must_not_be_blank(data):
	if not data:
		raise ValidationError('Data not provided.')

class RotationUrl(Base):
	__tablename__ = 'rotation_urls'
	id = Column(Integer, primary_key=True)
	url = Column(String(512), unique=False)	
	seconds = Column(Integer, unique=False)
	reload = Column(Boolean, unique=False)

	def __init__(self, url, seconds=10, reload=False):		
		self.url = url	
		self.seconds = notNone(seconds,10)	
		self.reload = notNone(reload,False)

	def __repr__(self):
		return '<Url %s %s>' % (self.name, self.url)

class RotationUrlSchema(Schema):
	id = fields.Int(dump_only=True)	
	url = fields.Str(required=True, validate=must_not_be_blank)
	seconds = fields.Int()
	reload = fields.Bool()
	
rotation_schema = RotationUrlSchema()
rotations_schema = RotationUrlSchema(many=True)

def notNone(s,d):
    if s is None:
        return d
    else:
        return s