import { Dictionary } from "@ff/core/types";
import Component from "@ff/graph/Component";
import Node from "@ff/graph/Node";

//Multilang property class, contains a key and a dictionary of language to value, with getter and setter for specific language
//Only supports 1 value per language for now, but the iiif spec allows for multiple values for each lang
//May not need to support multiple values for our use case, but something to keep in mind
export class MultilangProp{
    static readonly typeName: string = "MultilangProp";
    //Default text used if iiifJSONString is called and there are no values
    static readonly defaultText: string = "NONE";
    #key: string; //Key of property
    #values: Dictionary<string[]>; //Dictioary of language to value (this is an array so when we jsonify it is setup properly for the manifest)
    
    constructor(key: string) {
        this.#key = key;
        this.#values = {};
    }
    //Get value for a specific language, default to English if not found
    get(lang: string = "en"): string {
        return this.#values[lang][0];
    }
    set(lang: string, value: string) {
        this.#values[lang][0] = value;
    }

    key(): string{ return this.#key; }
    get langs(): string[] { return Object.keys(this.#values); }

    hasLang(lang: string): boolean {
        return !!this.#values[lang];
    }
    //Convert to a json string that can be directly added to a iiif manifest
    //JSON Object containg a key for each langauge specified, with the value being a strign array
    //defIfEmpty (Default if empty): if true and we have no values then the none key is added with the defaultText
    //                               If false and no values then we return an empty object
    iiifJSONString(defIfEmpty: boolean = true): string {
        const keys = this.langs;
        if(keys.length == 0 && defIfEmpty){ //No label set
            return `{\n\t"none": ["${MultilangProp.defaultText}"]\n}`;
        }
        else{
            return JSON.stringify(this.#values);
        }
    }
};

//Contains all manifest proprties with multilanguage support
//Optionally takes a reference to the parent object for retrieving id, and parent level data for the manifest properties
//  ^^^ Not currently implemented
export class ManifestProps{
    static readonly typeName: string = "ManifestProps";
    //Default keys added to every manifest object
    static readonly defaultKeys = ["label", "summary", "rights", "requiredStatement"];
    #base: Dictionary<MultilangProp> = {};
    #extra: Dictionary<MultilangProp> = {};
    #parent: Component | null;
    constructor(parent: Component | null){
        this.#parent = parent; 
        //Add base properties
        ManifestProps.defaultKeys.forEach((key) => {
            this.#base[key] = new MultilangProp(key);
        });
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
    set(key: string, value: string, lang: string = "en"){
        if(this.#extra[key]){
            this.#extra[key].set(lang, value);
        }
        else if(this.#base[key]){
            this.#base[key].set(lang, value);
        }
        else {
            const prop = new MultilangProp(key);
            prop.set(lang, value);
            this.#extra[key] = prop;
        }
    }
    //Adds property to extra if it doesnt exist
    add(key: string){
        if(this.has(key)){ return; }
        const prop = new MultilangProp(key);
        this.#extra[key] = prop;
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
};