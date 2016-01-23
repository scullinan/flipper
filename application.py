# http://flask.pocoo.org/docs/0.10/quickstart/#a-minimal-application

from flask import Flask, request, jsonify
from database import db_session, init_db
from models import RotationUrl, rotation_schema, rotations_schema

app = Flask(__name__)

@app.route('/rotations')
def get_rotations():
	rotations = RotationUrl.query.all()
	# Serialize the queryset
	result = rotations_schema.dump(rotations)
	return jsonify({'rotations':result.data})

@app.route("/rotations/<int:pk>")
def get_rotation(pk):
	try:
		rotation = RotationUrl.query.get(pk)
	except IntegrityError:
		return jsonify({"message": "Rotation could not be found."}), 400
	rotation_result = rotation_schema.dump(rotation)   
	return jsonify(rotation_result.data)

@app.route("/rotations", methods=["POST"])
def new_quote():
	json_data = request.get_json()
	if not json_data:
		return jsonify({'message': 'No input data provided'}), 400
	# Validate and deserialize input
	data, errors = rotation_schema.load(json_data)
	if errors:
		return jsonify(errors), 422
	name, path = data['name'], data['path']	
	rotation = RotationUrl.query.filter_by(name=name, path=path).first()
	if rotation is None:
		# Create a new rotation
		rotation = RotationUrl(name=name, path=path)
		db_session.add(rotation)
	
	db_session.commit()
	result = rotation_schema.dump(RotationUrl.query.get(rotation.id))
	return jsonify({"message": "Created new rotation url.",
					"rotation": result.data})

def notNone(s,d):
    if s is None:
        return d
    else:
        return s

if __name__ == '__main__':
	init_db()
	app.run(debug=True, port=5000)
