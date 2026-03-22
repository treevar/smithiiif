/**
 * 3D Foundation Project
 * Copyright 2026 SmithIIIF Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Dictionary } from "@ff/core/types";
import Component from "@ff/graph/Component";
import Property, { schemas } from "@ff/graph/Property";
import CVLanguageManager from "client/components/CVLanguageManager";
import { TLanguageType } from "client/schema/common";

//Inerface that has to be implemented by any component that wants to have manifest properties, this is used to check if a node has manifest properties
export interface IManifestProvider{
    readonly manifestProps: ManifestProps;
}

export function isManifestProvider(obj: any): obj is Component & IManifestProvider {
    return obj && obj.manifestProps instanceof ManifestProps;
}

export type ManifestNode = string | MultilangProp | { [key: string]: ManifestNode } | ManifestNode[] ;

//Multilang property class, contains a key and a dictionary of language to value, with getter and setter for specific language
//Only supports 1 value per language for now, but the iiif spec allows for multiple values for each lang
//May not need to support multiple values for our use case, but something to keep in mind
//  Figuring out how to implement with UI will be hardest part 
export class MultilangProp{
    static readonly typeName: string = "MultilangProp";
    readonly isMultiLang: boolean = true;
    //Default text used if iiifJSONString is called and there are no values
    static readonly defaultText: string = "NONE";
    #values: Dictionary<string[]>; //Dictionary of language to value (this is an array so when we jsonify it is setup properly for the manifest)
    
    constructor() {
        this.#values = {};
    }
    //Get value for a specific language
    get(lang: TLanguageType): string {
        if(!this.#values[lang] || !this.#values[lang][0]){
            return "";
        }
        return this.#values[lang][0];
    }
    //Set value for specific lang
    set(lang: TLanguageType, value: string) {
        //Lang array doesnt exist
        if(!this.#values[lang]) {
            this.#values[lang] = [];
        }
        //First elem doesnt exist
        if(!this.#values[lang][0]){
            this.#values[lang].push(value);
        }
        else{
            this.#values[lang][0] = value;
        }
    }

    get langs(): string[] { return Object.keys(this.#values); }

    hasLang(lang: TLanguageType): boolean {
        return !!this.#values[lang];
    }
    //Convert to a json string that can be directly added to a iiif manifest
    //JSON Object containing a key for each langauge specified, with the value being a string array
    //defIfEmpty (Default if empty): if true and we have no values then the none key is returned with the defaultText
    //                               If false and no values then we return an empty object
    toJSON(defIfEmpty: boolean = true){
        const keys = this.langs;

        if(keys.length == 0 && defIfEmpty){ //No label set
            return{
                "none": [MultilangProp.defaultText]
            };
        }
        else{
            return this.#values;
        }
    }
};

//Contains all manifest properties with multilanguage support
export class ManifestProps{
    static readonly typeName: string = "ManifestProps";
    //Default props added to every manifest object
    static readonly baseProperties: ManifestNode = {
        "label": new MultilangProp(),
        "summary": new MultilangProp(),
        "rights": "", //Single language string
        "requiredStatement": {
            "label": new MultilangProp(),
            "value": new MultilangProp()
        },
        "metadata": [
            {
                "label": new MultilangProp(),
                "value": new MultilangProp()
            },
            {
                "test":{
                    "value1": ""
                }
            }
        ] //Array of objects https://preview.iiif.io/api/prezi-4/presentation/4.0/model/#metadata
    }
    #data: Dictionary<ManifestNode> = {};

    #uiProperties: Dictionary<Property> = {}; //Used for interfacing with UI
    #langManager: CVLanguageManager = null;

    constructor(){
        //Add base properties
        this.createFromObject(ManifestProps.baseProperties);
    }
    //Get a property by key, return null if not found
    get(key: string): ManifestNode | null {
        return this.#resolvePath(key);
    }
    //Returns whether the property exists
    has(key: string): boolean {
        return !!this.get(key);
    }
    //Return dictionary of all properties
    get data(): Dictionary<ManifestNode> {
        return this.#data;
    }
    //Return array of all property keys
    get keys(): string[] {
        return Object.keys(this.data);
    }

    getUIProperty(key: string): Property | null{
        return this.#uiProperties[key] || null;
    }

    setLangManager(langManager: CVLanguageManager){
        if(this.langManager && this.langManager.id === langManager.id){ return; } //Lang manager is the same
        //remove old listener if it exists
        if(this.#langManager) {
            this.#langManager.off("tag-update", this.fillPropertyValues);
        }
        this.#langManager = langManager;
        this.#langManager.on("tag-update", this.fillPropertyValues);
    }

    get langManager(): CVLanguageManager {
        return this.#langManager;
    }

    get uiProperties(): Dictionary<Property> {  
        return this.#uiProperties;
    }

    //Fill UI Properties with the current language's value
    //If langManager wasnt set before calling then it defaults to english
    fillPropertyValues = () => {
        const lang = this.langManager?.codeString() ?? "EN";
        
        Object.entries(this.uiProperties).forEach(([path, prop]) => {
            const node = this.#resolvePath(path);
            
            if (node instanceof MultilangProp) {
                prop.setValue(node.get(lang));
            } 
            else if (typeof node === 'string') {
                prop.setValue(node);
            }
        });
    };

    //Calls structured clone to ensure the data isnt being shared across instances
    createFromObject(obj: ManifestNode){
        this.#addPropsFromObject(structuredClone(obj));
    }

    serialize(){
        return JSON.stringify(this.#data);
    }

    #addPropsFromObject(obj: ManifestNode, curPath: string = "", parent: ManifestNode | null = null) {
        Object.entries(obj).forEach(([key, value]) => {
            // Build the current path
            const thisPath = curPath.length === 0 ? key : `${curPath}.${key}`;
            
            // Skip nulls or undefined
            if (value === null || value === undefined) return;

            // Add root to data registry if it doesnt exist
            if (curPath === "") {
                if(!this.#data[key]){
                    this.#data[key] = value;
                }
                parent = this.#data;
            }
            

            if (Array.isArray(value)) {
                // Recurse into array
                value.forEach((item, index) => {
                    this.#addPropsFromObject(item, `${thisPath}.${index}`, parent[key][index]);
                });
            } 
            else if (typeof value === 'object' && !value.isMultiLang) {
                // Recurse into nested object
                this.#addPropsFromObject(value, thisPath, parent[key]);
            } 
            else {
                // Leaf node: Bind to UI
                if(!this.#uiProperties[thisPath]){
                    console.log(`adding path '${thisPath}'`);
                    //Send reference to internal data for easy updating
                    if(value.isMultiLang === true){
                        parent[key] = new MultilangProp(); //Structured clone will clone these as plain objects
                        this.#addMultiLangUIProperty(thisPath, parent[key]);
                    }
                    else{
                        this.#addPrimitiveUIProperty(thisPath, parent, key);
                    }
                }
            }
        });
    }

    #resolvePath(path: string): ManifestNode | null {
        const keys = path.split('.');
        if(keys.length === 0){ return null; }

        let current = this.#data[keys[0]];

        for (let i = 1; i < keys.length; ++i) {
            const key = keys[i];
            if (current === null || current === undefined){ return null; }
            current = current[key];
        }
        return current;
    }

    #addMultiLangUIProperty(key: string, node: MultilangProp){
        const uiProp = new Property(key, schemas.String, true);
        uiProp.on("value", (newValue: string) => {
            this.#onMultiLangPropertyChanged(node, newValue);
        }, this);
        this.#uiProperties[key] = uiProp;
    }

    //Primitives are passed by value not ref
    //So we pass the parent node with the key to access the primitive
    #addPrimitiveUIProperty(fullKey: string, parent: ManifestNode, parentKey: string){
        const uiProp = new Property(fullKey, schemas.String, true);
        uiProp.on("value", (newValue: string) => {
            this.#onPrimitivePropertyChanged(parent, parentKey, newValue);
        }, this);
        this.#uiProperties[fullKey] = uiProp;
    }

    //Removes a property from data
    //Assuming key is valid
    #rmProperty(key: string){
        this.#rmUICallbacks(key);

        const endParentIdx = key.lastIndexOf('.');

        let parentKey = endParentIdx !== -1 ? key.slice(0, endParentIdx) : "";
        let childKey = endParentIdx !== -1 ? key.slice(endParentIdx+1) : key;

        //If parentKey is empty then its a root node
        const parent = parentKey.length !== 0 ? this.#resolvePath(parentKey) : this.#data as ManifestNode;
        if(parent === null){ //This shouldnt happen
            console.error(`ManifestProps.#rmProperty(): Error resolving parent key. parentKey: "${parentKey}", childKey: "${childKey}"`);
            return;
        }

        delete parent[childKey];
    }

    //Removes all callabacks of type 'value' from the property
    //Assuming key is valid
    #rmUICallbacks(key: string){
        let node = this.#resolvePath(key);
        //if(node === null){ return; } //Bad key
        if(Array.isArray(node)){
            for(let i = 0; i < node.length; ++i){
                this.#rmUICallbacks(key + `.${i}`);
            }
        }
        else if(typeof node === 'object' && !(node instanceof MultilangProp)){ //Has children
            Object.keys(node).forEach((childKey) => {
                this.#rmUICallbacks(key + `.${childKey}`);
            });
        }
        else{
            let uiProp = this.getUIProperty(key);
            uiProp?.off("value", null, this);
        }
    }

    //Updates internal value when UI property value is changed
    #onMultiLangPropertyChanged(node: MultilangProp, value: string){
        if(!node){ //Bad node
            console.log(`ManifestProps.#onMultiLangPropertyChanged(): Bad node`);
            return;
        }
        const lang = this.#langManager?.codeString() ?? "EN";
        
        //Only update if value changed
        //Prevents event storm
        if(node.get(lang) !== value){
            //console.log("Action: Save", { key, lang, value });
            node.set(lang, value);
        }
    }

    #onPrimitivePropertyChanged(parent: ManifestNode, key: string, value: string){
        if(!parent || parent[key] === null || parent[key] === undefined){ //Bad node
            console.log(`ManifestProps.#onPrimitivePropertyChanged(): Bad parent/key Key: ${key}`);
            return;
        }
        if(parent[key] !== value){
            parent[key] = value;
        }
    }

};
