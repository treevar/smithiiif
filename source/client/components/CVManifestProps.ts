import { Dictionary } from "@ff/core/types";
import Component from "@ff/graph/Component";
import Node from "@ff/graph/Node";

//Manifest Property
class ManifestProp {
    #key: string; //Key of property
    #values: Dictionary<string>; //Dictioary of language to value
    //Get value for a specific language, default to English if not found
    constructor(key: string) {
        this.#key = key;
        this.#values = {};
    }
    get(lang: string = "en"): string {
        return this.#values[lang];
    }
    set(lang: string, value: string) {
        this.#values[lang] = value;
    }
    key(): string{ return this.#key; }
};

export class CVManifestProps extends Component {
    static readonly typeName: string = "CVManifestProps";
    static readonly defaultKeys = ["label", "summary", "rights", "requiredStatement"];
    #base: Dictionary<ManifestProp> = {};
    #extra: Dictionary<ManifestProp> = {};
    constructor(node: Node, id: string){
        super(node, id);
    }
    //Get a property by key, check extra first then base, return null if not found
    get(key: string): ManifestProp | null {
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
            const prop = new ManifestProp(key);
            prop.set(lang, value);
            this.#extra[key] = prop;
        }
    }
    //Adds property to extra if it doesnt exist
    add(key: string){
        if(this.has(key)){ return; }
        const prop = new ManifestProp(key);
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
    get all(): Dictionary<ManifestProp> {
        // Start with base, then spread extra over it so extra overrides base
        return { ...this.#base, ...this.#extra };
    }
    //Return array of all property keys
    get keys(): string[] {
        return Object.keys(this.all);
    }
};