# http://flask.pocoo.org/docs/0.10/quickstart/#a-minimal-application

from flask import Flask, request, jsonify, make_response
from database import db_session, init_db
from models import RotationUrl, rotation_schema, rotations_schema
from json import dumps
from auth import requires_auth

app = Flask(__name__)

@app.route('/rotations', methods=["GET"])
def get_rotations():
	rotations = RotationUrl.query.all()	
	# Serialize the queryset
	result = rotations_schema.dump(rotations)
	return make_response(dumps(result.data)), 200, {"Content-Type":"application/json"}

@app.route('/rotations', methods=["PUT"])
@requires_auth
def add_allrotations():
	json_data = request.get_json()
	if not json_data:
		return jsonify({'message': 'No input data provided'}), 400

	RotationUrl.query.delete()

	for u in json_data:
		# Validate and deserialize input
		data, errors = rotation_schema.load(u)
		if errors:
			return jsonify(errors), 422
		url, seconds, reload = data['url'], data.get('seconds',None), data.get('reload',None)			
		# Create a new rotation
		rotation = RotationUrl(url=url, seconds=seconds, reload=reload)
		db_session.add(rotation)
		
	db_session.commit()
	return jsonify({"message": "Rotations were all added successfully"})

@app.route("/rotations/<int:pk>")
def get_rotation(pk):
	try:
		rotation = RotationUrl.query.get(pk)
	except IntegrityError:
		return jsonify({"message": "Rotation could not be found."}), 404
	rotation_result = rotation_schema.dump(rotation)   
	return jsonify(rotation_result.data)

@app.route("/rotations/<int:pk>", methods=["DELETE"])
@requires_auth
def delete_rotation(pk):
	try:
		rotation = RotationUrl.query.get(pk)
	except IntegrityError:
		return jsonify({"message": "Rotation could not be found."}), 404
	RotationUrl.query.filter_by(id=pk).delete()	  
	return jsonify({'message': 'Rotation deleted'}), 200

@app.route("/rotations", methods=["POST"])
@requires_auth
def new_rotation():
	json_data = request.get_json()
	if not json_data:
		return jsonify({'message': 'No input data provided'}), 400
	# Validate and deserialize input
	data, errors = rotation_schema.load(json_data)
	if errors:
		return jsonify(errors), 422
	url, seconds, reload = data['url'], data.get('seconds',None), data.get('reload',None)	
	rotation = RotationUrl.query.filter_by(url=url).first()
	if rotation is None:
		# Create a new rotation
		rotation = RotationUrl(url=url, seconds=seconds, reload=reload)
		db_session.add(rotation)
	
	db_session.commit()
	result = rotation_schema.dump(RotationUrl.query.get(rotation.id))
	return jsonify({"message": "Created new rotation url.",
					"rotation": result.data})

if __name__ == '__main__':
	init_db()
	app.run(debug=True, port=5000, host='0.0.0.0')
