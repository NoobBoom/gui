require('../../../core/extras/string');
require('montage/core/extras/string');
require('json.sortify');

var FS = require('../fs-promise');
var Path = require('path');
var beautify = require('js-beautify').js_beautify;

var MODULE_FILE_TEMPLATE = "<REQUIRES>\n\nexports.<EXPORT_NAME> = AbstractModel.specialize(<PROTOTYPE_DESCRIPTOR>;";
var MODULE_FILE_CONSTRUCTOR_TEMPLATE = "<REQUIRES>\n\nexports.<EXPORT_NAME> = AbstractModel.specialize(<PROTOTYPE_DESCRIPTOR>, <CONSTRUCTOR_DESCRIPTOR>);";
var CONSTRUCTOR_PROPERTY_BLUEPRINTS_TEMPLATE = "{propertyBlueprints: { value: <PROPERTY_BLUEPRINTS> } }";
var REQUIRE_TEMPLATE = 'var <MODULE_NAME> = require("<MODULE_ID>").<MODULE_NAME>;';
var PROPERTY_TEMPLATE = '_<PROPERTY_NAME>:{value:null},<PROPERTY_NAME>:{set: function (value) {if (this._<PROPERTY_NAME> !== value) {this._<PROPERTY_NAME> = value;}}, get: function () {return this._<PROPERTY_NAME>;}}';
var PROPERTY_OBJECT_TEMPLATE = '_<PROPERTY_NAME>:{value:null},<PROPERTY_NAME>:{set: function (value) {if (this._<PROPERTY_NAME> !== value) {this._<PROPERTY_NAME> = value;}}, get: function () {return this._<PROPERTY_NAME> || (this._<PROPERTY_NAME> = new <MODULE_NAME>());}}';

var ModelObject = function ModelObject (descriptor) {
    this.name = descriptor.root.properties.name;
    this.fileName = _toFileName(descriptor.root.properties.name, "-");
    this.requires = [
        {
            name: "AbstractModel",
            moduleId: "core/model/abstract-model"
        }
    ];

    this.requiresMap = new Map ();
    this.requiresMap.set("AbstractModel", true);
    this.properties = [];
};

var createModelWithDescriptor = exports.createModelWithDescriptor = function createModelWithNameAndDescriptor (descriptor) {
    var model = new ModelObject(descriptor),
        propertyBlueprints = descriptor.root.properties.propertyBlueprints,
        property, propertyDescriptor, i , length;

    if (propertyBlueprints) {
        for (i = 0, length = propertyBlueprints.length; i < length; i++) {
            property = descriptor[propertyBlueprints[i]["@"]];

            propertyDescriptor = {
                name: property.properties.name,
                valueType: property.properties.valueType,
                mandatory: !!property.properties.mandatory
            };

            if (property.properties.valueObjectPrototypeName) {
                propertyDescriptor.valueObjectPrototypeName = property.properties.valueObjectPrototypeName;

                if (!model.requiresMap.has(propertyDescriptor.valueObjectPrototypeName)) {
                    model.requiresMap.set(propertyDescriptor.valueObjectPrototypeName, true);

                    model.requires.push({
                        name: propertyDescriptor.valueObjectPrototypeName,
                        moduleId: "core/model/models/" + _toFileName(propertyDescriptor.valueObjectPrototypeName, "-")
                    });
                }
            }

            if (property.properties.readyOnly) {
                propertyDescriptor.readyOnly = true;
            }

            model.properties.push(propertyDescriptor);
        }
    }

    return model;
};


function _toFileName (name, separator) {
    return name.split(/(?=[A-Z])/).join(separator).toLowerCase();
}


ModelObject.prototype.toJS = function () {
    var PROTOTYPE_DESCRIPTOR = "", REQUIRES = "",
        i, length, property, _require,
        // TODO: enable feature later
        // Need to add class method +  prototype method on compiled files.
        // Need to remove all the "manual" initilialization of the valueObjectPrototypeName within GUI
       enableMultipleRequires = false;

    for (i = 0, length = this.properties.length; i < length; i++) {
        property = this.properties[i];

        if (enableMultipleRequires && property.valueObjectPrototypeName && this.requiresMap.has(property.valueObjectPrototypeName)) {
            PROTOTYPE_DESCRIPTOR += ((PROPERTY_OBJECT_TEMPLATE.replace(/<PROPERTY_NAME>/ig, property.name))
                .replace(/<MODULE_NAME>/ig, property.valueObjectPrototypeName));
        } else {
            PROTOTYPE_DESCRIPTOR += PROPERTY_TEMPLATE.replace(/<PROPERTY_NAME>/ig, property.name);
        }

        if (length - 1 !== i) {
            PROTOTYPE_DESCRIPTOR += ",";
        }
    }

    PROTOTYPE_DESCRIPTOR = "{" + PROTOTYPE_DESCRIPTOR + "}";

    if (enableMultipleRequires) {
        for (i = 0, length = this.requires.length; i < length; i++) {
            _require = this.requires[i];

            REQUIRES += ((REQUIRE_TEMPLATE.replace(/<MODULE_NAME>/ig, _require.name)).replace(/<MODULE_ID>/ig, _require.moduleId));
        }
    } else {
        REQUIRES += ((REQUIRE_TEMPLATE.replace(/<MODULE_NAME>/ig, this.requires[0].name)).replace(/<MODULE_ID>/ig, this.requires[0].moduleId));
    }

    if (this.properties.length) {
        var CONSTRUCTOR_DESCRIPTOR = CONSTRUCTOR_PROPERTY_BLUEPRINTS_TEMPLATE.replace(/<PROPERTY_BLUEPRINTS>/ig, JSON.sortify(this.properties));
        CONSTRUCTOR_DESCRIPTOR = CONSTRUCTOR_DESCRIPTOR.replace(/\"([^(\")"]+)\":/g,"$1:");

        return ((MODULE_FILE_CONSTRUCTOR_TEMPLATE.replace(/<EXPORT_NAME>/ig, this.name))
            .replace(/<PROTOTYPE_DESCRIPTOR>/ig, PROTOTYPE_DESCRIPTOR)
            .replace(/<REQUIRES>/ig, REQUIRES)
            .replace(/<CONSTRUCTOR_DESCRIPTOR>/ig, CONSTRUCTOR_DESCRIPTOR));
    }

    return ((MODULE_FILE_TEMPLATE.replace(/<EXPORT_NAME>/ig, this.name))
        .replace(/<PROTOTYPE_DESCRIPTOR>/ig, PROTOTYPE_DESCRIPTOR)
        .replace(/<REQUIRES>/ig, REQUIRES));
};

exports.saveModelsAtPath = function saveModelsAtPath (models, path) {
    var files = [];

    for (var i = 0, length = models.length; i < length; i++) {
        files.push(saveModelWithPathAndFileName(models[i], path));
    }

    return Promise.all(files);
};

var saveModelWithPathAndFileName = exports.saveModelWithPathAndFileName = function (model, path) {
    path = Path.join(path, model.fileName + ".js");

    if (global.verbose) {
        console.log("writing " + path);
    }

    return FS.writeFileAtPathWithData(path, beautify(model.toJS(), {
        space_after_anon_function: true,
        end_with_newline: true
    }));
};