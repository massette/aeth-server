import os, os.path
from flask import Flask, request, redirect, send_file, send_from_directory
import requests
import gzip
import pygame
import threading
import time
import json

####################################################################################
CHILD_ADDR = "http://10.78.140.179"
# todo: broadcast to all connected devices

LEFT_VIEWPORT  = "{\"x\": 800, \"y\": 0, \"w\": 800, \"h\": 480}"
RIGHT_VIEWPORT = "{\"x\": 0, \"y\": 0, \"w\": 800, \"h\": 480}"
ABOVE_VIEWPORT = "{\"x\": 0, \"y\": 480, \"w\": 800, \"h\": 480}"
BELOW_VIEWPORT = "{\"x\": 0, \"y\": 0, \"w\": 800, \"h\": 480}"

################################################################## MAPS DIRECTORY ##
MAPS_DIR = os.path.abspath("public/images")
MAPS_DATA = os.path.abspath("maps.json")

MAPS_TYPES = {
    "png": "image/png"
}

########################################################################### SETUP ##
# setup flask
app = Flask(__name__)
app.use_reloader = False

# setup pygame
pygame.init()
screen = pygame.display.set_mode((0, 0), pygame.FULLSCREEN)

original_image = pygame.Surface((1600, 800))
viewport = json.loads(RIGHT_VIEWPORT)

# load map data
maps = {}

try:
    with open(MAPS_DATA, "r") as maps_file:
        maps = json.load(maps_file)
    print("Read maps directory.")
except FileNotFoundError:
    print("No existing maps directory.")

############################################################### SERVE UPLOAD PAGE ##
@app.route("/", methods=["GET"])
def route_home():
    return send_from_directory(os.path.abspath("public/pages/"), "upload.html");

################################################################### API ENDPOINTS ##
@app.route("/maps", methods=["POST", "GET"])
def route_maps():
    if request.method == "POST":
        # check if file attached
        if "image" not in request.files:
            print("No file part!")
            return redirect(request.url)
        
        # check that file isn't empty
        upload = request.files["image"]
        if upload.filename == "":
            print("No file selected!")
            return redirect(request.url)
        
        # check for valid file type
        if "." not in upload.filename:
            print("Invalid file type!")
            return redirect(request.url)
        
        # split file extension
        ext = upload.filename.rsplit(".", 1)[1].lower()

        # download file!
        if ext in MAPS_TYPES:
            # get map properties
            map_id = request.form["id"]
            map_type = MAPS_TYPES[ext]

            # get name, defaulting to id
            if "name" in request.form:
                map_name = request.form["name"]
            else:
                map_name = request.form["id"]
            
            # created map object
            maps[map_id] = {
                "id": map_id,
                "name": map_name,
                "type": map_type,
                "filename": map_id + "." + ext,
                "endpoint": "/maps/" + map_id
            }

            # save image
            upload.save(os.path.join(MAPS_DIR, maps[map_id]["filename"]))

            # update maps directory
            with open(MAPS_DATA, "w") as maps_file:
                json.dump(maps, maps_file)

    # return maps as JSON object
    return maps

@app.route("/maps/<id>", methods=["GET", "PUT", "DELETE"])
def route_map(id):
    if request.method == "PUT":
        # check if file attached
        if "image" not in request.files:
            print("No file part!")
            return redirect(request.url)
        
        # check that file isn't empty
        upload = request.files["image"]
        if upload.filename == "":
            print("No file selected!")
            return redirect(request.url)
        
        # check for valid file type
        if "." not in upload.filename:
            print("Invalid file type!")
            return redirect(request.url)
        
        # split file extension
        ext = upload.filename.rsplit(".", 1)[1].lower()

        # download file!
        if ext in MAPS_TYPES:
            # get map properties
            map_type = MAPS_TYPES[ext]

            # get name, defaulting to id
            if "name" in request.form:
                map_name = request.form["name"]
            else:
                map_name = request.form["id"]
            
            # created map object
            maps[id] = {
                "id": id,
                "name": map_name,
                "type": map_type,
                "filename": id + "." + ext,
                "endpoint": "/maps/" + id
            }

            # save image
            upload.save(os.path.join(MAPS_DIR, maps[id]["filename"]))

            # update maps directory
            with open(MAPS_DATA, "w") as maps_file:
                json.dump(maps, maps_file)
    elif request.method == "DELETE":
        # delete file
        os.remove(os.path.join(MAPS_DIR, maps[id]["filename"]))

        # remove entry
        del maps[id]
        return redirect("/maps")

    if id in maps:
        return maps[id]
    else:
        return "Map not found!", 404

@app.route("/maps/<id>/image", methods=["GET", "PUT"])
def route_map_image(id):
    if request.method == "PUT":
        # check if file attached
        if "image" not in request.files:
            print("No file part!")
            return redirect(request.url)
        
        # check that file isn't empty
        upload = request.files["image"]
        if upload.filename == "":
            print("No file selected!")
            return redirect(request.url)
        
        # check for valid file type
        if "." not in upload.filename:
            print("Invalid file type!")
            return redirect(request.url)
        
        # split file extension
        ext = upload.filename.rsplit(".", 1)[1].lower()

        # download file!
        if ext in MAPS_TYPES:
            # get map properties
            map_type = MAPS_TYPES[ext]

            # created map object
            maps[id]["filename"] =  id + "." + ext,
            maps[id]["type"] = map_type

            # save image
            upload.save(os.path.join(MAPS_DIR, maps[id]["filename"]))

            # update maps directory
            with open(MAPS_DATA, "w") as maps_file:
                json.dump(maps, maps_file)

    if id not in maps:
        return "Map not found!", 404

    return send_file(
        os.path.join(MAPS_DIR, maps[id]["filename"]),
        mimetype = maps[id]["type"]
    )

@app.route("/select/<id>", methods=["POST", "PUT"])
def route_select(id):
    global original_image

    # check that map exists
    if id not in maps:
        return "Map not found!", 404
    
    # send image to child devices
    path = os.path.join(MAPS_DIR, maps[id]["filename"])
    data = b""

    with open(path, "rb") as f:
        data = gzip.compress(f.read())
    
    print("Compressing image...")
    time.sleep(5)

    res = requests.post(CHILD_ADDR + "/image", data)
    
    # load image
    original_image = pygame.image.load(path)
    return "Success!", 200

@app.route("/update_pos", methods=["POST", "PUT"])
def route_viewport():
    global viewport

    # get orientation of child
    if request.data == "":
        side = requests.get(CHILD_ADDR + "/side").json()
    else:
        side = json.loads(request.data)

    # set viewports

    if side == "above":
        requests.post(CHILD_ADDR + "/viewport", ABOVE_VIEWPORT)
        viewport = json.loads(BELOW_VIEWPORT)
    elif side == "below":
        requests.post(CHILD_ADDR + "/viewport", BELOW_VIEWPORT)
        viewport = json.loads(ABOVE_VIEWPORT)
    elif side == "left":
        requests.post(CHILD_ADDR + "/viewport", LEFT_VIEWPORT)
        viewport = json.loads(RIGHT_VIEWPORT)
    elif side == "right":
        requests.post(CHILD_ADDR + "/viewport", RIGHT_VIEWPORT)
        viewport = json.loads(LEFT_VIEWPORT)

    return "Success!", 200

def update_image():
    screen.blit(original_image, (0,0), (viewport["x"], viewport["y"], viewport["w"], viewport["h"]))
    pygame.display.update()

if __name__ == "__main__":
    threading.Thread(target = lambda: app.run("0.0.0.0", 80)).start()

while True:
    for event in pygame.event.get():
      if event.type == pygame.QUIT:
         pygame.quit()
    
    update_image()