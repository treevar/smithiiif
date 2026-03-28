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

//Importing from manifest
// - Need to ident arrays from multilang props
// - build object from manifest and insert using createFromObject
// X Need to add support for adding values via createFromObject

//Adding optional props
// X baseProperties are the ONLY required fields (label)
// - When jsonify we can check useing the baseProperties object if an object is required
// X Additional task view/popout for selecting from predefined properties
//   * Will be defined in a static map of key to object to be processed into ManifestProps
// - CHECK, but every array property should have an add button to add new entries

//Optional props to consider
// provider - https://preview.iiif.io/api/prezi-4/presentation/4.0/model/#provider
// seeAlso - https://preview.iiif.io/api/prezi-4/presentation/4.0/model/#seeAlso

//Arrays need a seperate dictionary of object templates so we know what to insert when we add elems to the array
// #arrayDefs: Dictionary<ManifestNode> = {}

import { Dictionary } from "@ff/core/types";
import Component from "@ff/graph/Component";
import Property, { schemas } from "@ff/graph/Property";
import CVLanguageManager from "client/components/CVLanguageManager";
import { TLanguageType } from "client/schema/common";

//Inerface that has to be implemented by any component that wants to have manifest properties, this is used to check if a node has manifest properties
export interface IManifestProvider{
    readonly manifestProps: ManifestProps;
}

//Says its a component as well so it doesnt lose idetity when this is called
// *If we ever meed to add ManifestProps to a non component then this will need ot be changed
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
    private values: Dictionary<string[]>; //Dictionary of language to value (this is an array so when we jsonify it is setup properly for the manifest)
    
    //startValsis a language object that will be used to init the internal
    constructor(startVals: Dictionary<string[]> | string = null) {
        if(startVals === null){
            this.values = {};
        }
        else if(typeof startVals === 'object'){
            //Copy as its pass by ref
            this.values = structuredClone(startVals);
        }
        else{ //String (default val for english)
            this.values = {"en":[startVals]};
        }
    }
    //Get value for a specific language
    get(lang: TLanguageType): string {
        const langStr = lang.toLowerCase();
        if(!this.values[langStr] || !this.values[langStr][0]){
            return "";
        }
        return this.values[langStr][0];
    }
    //Set value for specific lang
    set(lang: TLanguageType, value: string) {
        const langStr = lang.toLowerCase();
        //Lang array doesnt exist
        if(!this.values[langStr]) {
            this.values[langStr] = [];
        }
        //First elem doesnt exist
        if(!this.values[langStr][0]){
            this.values[langStr].push(value);
        }
        else{
            this.values[langStr][0] = value;
        }
    }

    //Returns array of lang keys
    //Keys are added if the corresponsing lang has a value set
    get langs(): string[] {
        let keys: string[] = [];
        Object.entries(this.values).forEach(([key, value]) => {
            if(value && value.length > 0){
                keys.push(key);
            }
        });
        return keys;
    }

    //Returns whether a value is set for the specified lang (empty string doesnt count)
    hasLang(lang: TLanguageType): boolean {
        const langStr = lang.toLowerCase();
        return this.values[langStr] && this.values[langStr].length > 0;
    }
    
    //JSON Object containing a key for each langauge specified, with the value being a string array
    toJSON(/*defIfEmpty: boolean = true*/){
        //const keys = this.langs;

        /*if(keys.length == 0 && defIfEmpty){ //No label set
            return{
                "none": [MultilangProp.defaultText]
            };
        }
        else*/{
            return this.values;
        }
    }
};

//Contains all manifest properties with multilanguage support
export class ManifestProps{
    static readonly typeName: string = "ManifestProps";
    //Default props added to every manifest object
    static readonly baseProperties: Dictionary<ManifestNode> = {
        "label": new MultilangProp()
    }

    static readonly optionalProperties: Dictionary<ManifestNode> = {
        "summary": new MultilangProp(),
        "requiredStatement": {
            "label": new MultilangProp(),
            "value": new MultilangProp()
        },
        "rights": ""
        //"metadata": [] //Array of objects https://preview.iiif.io/api/prezi-4/presentation/4.0/model/#metadata
    };

    #data: Dictionary<ManifestNode> = {};
    #optionals: Dictionary<ManifestNode> = {};

    #uiProperties: Dictionary<Property> = {}; //Used for interfacing with UI
    #langManager: CVLanguageManager = null;

    constructor(optionalProps: Dictionary<ManifestNode> = ManifestProps.optionalProperties){
        //Set optionals
        this.#addPropsFromObject(structuredClone(optionalProps), this.#optionals, "", false, true);
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
    //Return array of all root property keys
    get keys(): string[] {
        return Object.keys(this.data);
    }

    getUIProperty(key: string): Property | null{
        return this.#uiProperties[key] || null;
    }

    //Since this isnt part of voyager's node system it doesnt have acces to the lang mananger
    //Set lang mananger so we can properly get langs from multilang props
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

    //Optional properties that can be added
    // *Note these could already be added
    get optionals(): Dictionary<ManifestNode> {
        return this.#optionals;
    }

    //Fill UI Properties with the current language's value
    //If langManager wasnt set before calling then it defaults to english
    fillPropertyValues = () => {
        const lang = this.#getCurLang();
        
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
    createFromObject(obj: ManifestNode, clone: boolean = true, copyData: boolean = false){
        const addingObj = clone ? structuredClone(obj) : obj;
        this.#addPropsFromObject(addingObj, this.#data, "", true, copyData);
    }

    //Convert entire data object into stringified JSON
    serialize(){
        return JSON.stringify(this.#data);
    }

    //If the value associated with the key has children we need to rm those as well
    removeProp(key: string){
        if(key.indexOf('.') == -1){ //Root
            
        }
    }

    //Add all properties currently in data to the supplied object if they have a value set
    //Returns the new object
    // *Note this does not modify obj
    addToObject(obj: object): object{
        let addingObj = {};

        Object.entries(this.#data).forEach(([key, value]) => {
            if(this.nodeHasValue(value)){
                addingObj[key] = value;
            }
        });

        obj = { //Breaks reference
            ...obj,
            ...addingObj
        }

        return obj;
    }

    //Returns whether the manifest node supplied has a value set
    nodeHasValue(node: ManifestNode): boolean{
        if(node === null){ return false; }

        if(Array.isArray(node)){
            if(node.length === 0){ return false; }

            let i = 0;
            for(; i < node.length; ++i){
                if(this.nodeHasValue(node[i])){ break; }
            }

            if(i < node.length){ return true; }
            else{ return false; }
        }
        else if(typeof node === 'object'){
            if(node instanceof MultilangProp){
                //Has a val set for atleast one lang
                if(node.langs.length > 0){ return true; }
                else{ return false; }
            }
            //Make sure object isnt empty
            const objKeys = Object.keys(node);
            if(objKeys.length === 0){ return false; }

            let i = 0;
            for(; i < objKeys.length; ++i){
                if(this.nodeHasValue(node[objKeys[i]])){ break; }
            }

            if(i < objKeys.length){ return true; }
            else{ return false; }
        }
        else{ //Primitive
            return node.length > 0;
        }

    }

    #addPropsFromObject(obj: ManifestNode, parent: ManifestNode = this.#data, curPath: string = "", createUiProps: boolean = false, loadData: boolean = false) {
        createUiProps = parent === this.#data || createUiProps;
        Object.entries(obj).forEach(([key, value]) => {
            // Build the current path
            const thisPath = curPath.length === 0 ? key : `${curPath}.${key}`;
            
            // Skip nulls or undefined
            if (value === null || value === undefined) return;

            // Add root to data registry if it doesnt exist
            if (curPath === "") {
                if(!parent[key]){
                    parent[key] = value;
                }
            }
            

            if (Array.isArray(value)) {
                // Recurse into array
                value.forEach((item, index) => {
                    this.#addPropsFromObject(item, parent[key][index], `${thisPath}.${index}`, createUiProps, loadData);
                });
            } 
            else if (typeof value === 'object' && !value.isMultiLang) {
                // Recurse into nested object
                this.#addPropsFromObject(value, parent[key], thisPath, createUiProps, loadData);
            } 
            else {
                // Leaf node: Bind to UI
                if(!this.#uiProperties[thisPath]){
                    console.log(`adding path '${thisPath}'`);
                    //Send reference to internal data for easy updating
                    if(value.isMultiLang === true){
                        if(loadData){
                            parent[key] = Object.assign(new MultilangProp(), value); //Structured clone will clone these as plain objects
                        }
                        else{
                            parent[key] = new MultilangProp();
                        }

                        if(createUiProps){
                            this.#addMultiLangUIProperty(thisPath, parent[key]);
                        }
                    }
                    else{
                        if(loadData){
                            console.log(`adding primitive "${key}": "${value}"`);
                            parent[key] = value;
                        }
                        if(createUiProps){
                            this.#addPrimitiveUIProperty(thisPath, parent, key);
                        }
                    }
                }
            }
        });
    }

    #resolvePath(path: string): ManifestNode | null {
        let keys = path.split('.');
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
        const lang = this.#getCurLang();
        const curLangVal = node.get(lang);
        if(curLangVal && curLangVal.length > 0){
            uiProp.setValue(curLangVal);
        }
        uiProp.on("value", (newValue: string) => {
            this.#onMultiLangPropertyChanged(node, newValue);
        }, this);
        this.#uiProperties[key] = uiProp;
    }

    //Primitives are passed by value not ref
    //So we pass the parent node with the key to access the primitive
    #addPrimitiveUIProperty(fullKey: string, parent: ManifestNode, parentKey: string){
        const uiProp = new Property(fullKey, schemas.String, true);
        const value = parent[parentKey];
        if(value && (value as string).length > 0){
            uiProp.setValue(value);
        }
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

        //Need to update callbacks for elems after this as the index will shift 1 left
        if(Array.isArray(parent[childKey])){

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
        const lang = this.#getCurLang();
        
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

    #getCurLang(): TLanguageType{
        return this.#langManager?.codeString() ?? "EN";
    }
};
