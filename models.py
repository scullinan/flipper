# https://marshmallow.readthedocs.org/en/latest/examples.html#quotes-api-flask-sql-alchemy
import datetime
from sqlalchemy import Column, Integer, String, DateTime
from database import Base
from marshmallow import Schema, fields, ValidationError

# Custom validator
def must_not_be_blank(data):
	if not data:
		raise ValidationError('Data not provided.')

class RotationUrl(Base):
	__tablename__ = 'rotation_urls'
	id = Column(Integer, primary_key=True)
	name = Column(String(50), unique=False)
	path = Column(String(512), unique=False)	
	display_seconds = Column(Integer, unique=False)

	def __init__(self, name, path, display_seconds=10):
		self.name = name
		self.path = path	
		self.display_seconds = notNone(display_seconds,10)	

	def __repr__(self):
		return '<Url %s %s>' % (self.name, self.path)

class RotationUrlSchema(Schema):
	id = fields.Int(dump_only=True)
	name = fields.Str(required=True, validate=must_not_be_blank)
	path = fields.Str(required=True, validate=must_not_be_blank)
	display_seconds = fields.Int()
	
rotation_schema = RotationUrlSchema()
rotations_schema = RotationUrlSchema(many=True)

def notNone(s,d):
    if s is None:
        return d
    else:
        return s