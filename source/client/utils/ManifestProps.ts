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

//Multilang property class, contains a key and a dictionary of language to value, with getter and setter for specific language
//Only supports 1 value per language for now, but the iiif spec allows for multiple values for each lang
//May not need to support multiple values for our use case, but something to keep in mind
//  Figuring out how to implement with UI will be hardest part 
export class MultilangProp{
    static readonly typeName: string = "MultilangProp";
    //Default text used if iiifJSONString is called and there are no values
    static readonly defaultText: string = "NONE";
    #key: string; //Key of property
    #values: Dictionary<string[]>; //Dictionary of language to value (this is an array so when we jsonify it is setup properly for the manifest)
    
    constructor(key: string) {
        this.#key = key;
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

    get key(): string{ return this.#key; }
    get langs(): string[] { return Object.keys(this.#values); }

    hasLang(lang: TLanguageType): boolean {
        return !!this.#values[lang];
    }
    //Convert to a json string that can be directly added to a iiif manifest
    //JSON Object containing a key for each langauge specified, with the value being a string array
    //incKey (Include Key): If true then the key is included in the JSON, ie "foo": {"EN":["bar"]}
    //                      If false then just the data is returned, ie {"EN":["bar"]}
    //defIfEmpty (Default if empty): if true and we have no values then the none key is returned with the defaultText
    //                               If false and no values then we return an empty object
    iiifJSONString(incKey: boolean = false, defIfEmpty: boolean = true): string {
        const keys = this.langs;
        let out = "";

        if(incKey){
            out += `"${this.key}: "`
        }
        if(keys.length == 0 && defIfEmpty){ //No label set
            out += `{\n\t"none": ["${MultilangProp.defaultText}"]\n}`;
        }
        else{
            out += JSON.stringify(this.#values);
        }

        return out;
    }
};

//Contains all manifest properties with multilanguage support
export class ManifestProps{
    static readonly typeName: string = "ManifestProps";
    //Default keys added to every manifest object
    static readonly baseKeys = ["label", "summary", "rights", "requiredStatement"];
    //Key/value stores
    #base: Dictionary<MultilangProp> = {};
    #extra: Dictionary<MultilangProp> = {};

    #uiProperties: Dictionary<Property> = {}; //Used for interfacing with UI
    #langManager: CVLanguageManager = null;

    constructor(){
        //Add base properties
        const addToBase: boolean = true;
        ManifestProps.baseKeys.forEach((key) => {
            this.#addNewKey(key, addToBase);
        });
        //this.fillPropertyValues();
    }
    //Get a property by key, check extra first then base, return null if not found
    get(key: string): MultilangProp | null {
        if(this.#extra[key]) {
            return this.#extra[key];
        }
        if(this.#base[key]) {
            return this.#base[key];
        }
        return null;
    }
    //Set property value for a specific language, if property doesn't exist create it in extra
    set(key: string, value: string, lang: TLanguageType){
        
        if(this.#extra[key]){
            this.#extra[key].set(lang, value);
        }
        else if(this.#base[key]){
            this.#base[key].set(lang, value);
        }
        else {
            const prop = this.add(key);
            prop.set(lang, value);
        }
    }
    //Adds property to extra if it doesnt exist
    add(key: string): MultilangProp{
        const existing = this.get(key);
        if(existing) {
            return existing;
        }
        return this.#addNewKey(key);
    }
    //Adds multiple properties to extra if they dont exist
    addMulti(keys: string[]){
        keys.forEach(key => this.add(key));
    }
    //Returns whether the property exists in either base or extra
    has(key: string): boolean {
        return !!this.get(key);
    }
    //Return dictionary of all properties, with extra properties overriding base properties
    get all(): Dictionary<MultilangProp> {
        // Start with base, then spread extra over it so extra overrides base
        return { ...this.#base, ...this.#extra };
    }
    //Return array of all property keys
    get keys(): string[] {
        return Object.keys(this.all);
    }

    get baseKeys(): string[] {
        return Object.keys(this.#base);
    }

    get extraKeys(): string[] {
        return Object.keys(this.#extra);
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

    get properties(): Dictionary<Property> {  
        return this.#uiProperties;
    }

    //Fill UI Properties with the current language's value
    //If langManager wasnt set before calling then it defaults to english
    fillPropertyValues = () => {
        const lang = this.langManager?.codeString() ?? "EN";
        
        Object.entries(this.properties).forEach(([key, prop]) => {
            if(prop) {
                const val = this.get(key)?.get(lang);
                
                prop.setValue(val);
                
            }
        });
    }

    #addNewKey(key: string, base: boolean = false): MultilangProp {
        let prop = new MultilangProp(key);
        if(base) {
            this.#base[key] = prop;
        } else {
            this.#extra[key] = prop;
        }
        this.#addUIProperty(key);
        return prop;
    }

    #addUIProperty(key: string){
        const uiProp = new Property(key, schemas.String, true);
        uiProp.on("value", (newValue: string) => {
            this.#onPropertyChanged(key, newValue);
        });
        this.#uiProperties[key] = uiProp;
    }

    //Updates internal value when UI property value is changed
    #onPropertyChanged(key: string, value: string){
        const prop = this.get(key);
        if(!prop){ //Bad key
            console.log(`ManifestProps.#onPropertyChanged(): Bad key '${key}'`);
            return;
        }
        const lang = this.#langManager?.codeString() ?? "EN";
        
        //Only update if value changed
        //Prevents event storm
        if(prop.get(lang) !== value){
            //console.log("Action: Save", { key, lang, value });
            prop.set(lang, value);
        }
    }
};
