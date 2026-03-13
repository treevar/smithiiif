import { Dictionary } from "@ff/core/types";
import Component from "@ff/graph/Component";
import Property, { schemas } from "@ff/graph/Property";
import CVLanguageManager from "client/components/CVLanguageManager";
import { TLanguageType } from "client/schema/common";
//import Component from "@ff/graph/Component";

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
    #values: Dictionary<string[]>; //Dictioary of language to value (this is an array so when we jsonify it is setup properly for the manifest)
    
    constructor(key: string) {
        this.#key = key;
        this.#values = {};
    }
    //Get value for a specific language, default to English
    get(lang: TLanguageType = "EN"): string {
        return this.#values[lang][0];
    }
    set(lang: TLanguageType, value: string) {
        this.#values[lang][0] = value;
    }

    key(): string{ return this.#key; }
    get langs(): string[] { return Object.keys(this.#values); }

    hasLang(lang: TLanguageType): boolean {
        return !!this.#values[lang];
    }
    //Convert to a json string that can be directly added to a iiif manifest
    //JSON Object containg a key for each langauge specified, with the value being a strign array
    //defIfEmpty (Default if empty): if true and we have no values then the none key is returned with the defaultText
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
export class ManifestProps{
    static readonly typeName: string = "ManifestProps";
    //Default keys added to every manifest object
    static readonly defaultKeys = ["label", "summary", "rights", "requiredStatement"];
    #base: Dictionary<MultilangProp> = {};
    #extra: Dictionary<MultilangProp> = {};

    #properties: Dictionary<Property> = {}; //Used for interfacing with UI
    #langManager: CVLanguageManager = null;
    //#parent: Component | null;
    constructor(){
        //Add base properties
        const addToBase: boolean = true;
        ManifestProps.defaultKeys.forEach((key) => {
            this.#addNewKey(key, addToBase);
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
    set(key: string, value: string, lang: TLanguageType = "EN"){
        
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

    getProperty(key: string): Property | null{
        return this.#properties[key] || null;
    }

    setLangManager(langManager: CVLanguageManager){
        this.#langManager = langManager;
    }

    #addNewKey(key: string, base: boolean = false): MultilangProp {
        const prop = new MultilangProp(key);
        if(base) {
            this.#base[key] = prop;
        } else {
            this.#extra[key] = prop;
        }
        this.#addProperty(key);
        return prop;
    }

    #addProperty(key: string){
        const prop = new Property(key, schemas.String, true);
        prop.on("value", (newValue: string) => {
            this.#onPropertyChanged(key, newValue);
        });
        this.#properties[key] = prop;
    }

    #onPropertyChanged(key: string, value: string){
        const prop = this.get(key);
        const lang = this.#langManager ? this.#langManager.codeString() : "EN";
        if(prop) {
            prop.set(lang, value);
        }
    }
};
