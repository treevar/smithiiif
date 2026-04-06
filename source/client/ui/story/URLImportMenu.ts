/**
 * 3D Foundation Project
 * Copyright 2025 Smithsonian Institution
 * * ImportMenu.ts
 * 
 * Copyright 2026 SmithIIIF Team
 * * Modified for use in importing via a url
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

import Popup, { customElement, html } from "@ff/ui/Popup";

import "@ff/ui/Button";
import { isURL } from "client/utils/patchFetch";

////////////////////////////////////////////////////////////////////////////////

//Type of data we are importing
export type DataType = "model" | "manifest";

@customElement("sv-url-import-menu")
export default class URLImportMenu extends Popup
{
    protected url: string = "";
    protected errorString: string = "";
    protected type: DataType = null;
    //protected assetName: string = "";
    //protected ext: string = "";

    static readonly dataTypeName = new Map<DataType, string>([
        ["model", "Model"],
        ["manifest", "Manifest"]
    ]);

    /*static readonly allowedExtensions = new Map<DataType, string[]>([
        ["model", [".gltf", ".glb"]],
        ["manifest", [".json"]]
    ]);*/

    static show(parent: HTMLElement, type: DataType): Promise<string>
    {
        const menu = new URLImportMenu(type);
        parent.appendChild(menu);

        return new Promise((resolve, reject) => {
            menu.on("confirm", () => resolve(menu.url));
            menu.on("close", () => reject());
        });
    }

    constructor(type: DataType)
    {
        super();
        this.type = type;
        this.position = "center";
        this.modal = true;
    }

    close()
    {
        this.dispatchEvent(new CustomEvent("close"));
        this.remove();
    }

    /*verifyExtension(ext: string): boolean{
        if(!this.type){ return false; }
        const validExts = URLImportMenu.allowedExtensions.get(this.type);
        if(validExts === undefined){ return false; }
        return validExts.includes(ext);
    }*/

    confirm()
    {
        if(this.url === "") {
            this.errorString = "Please enter a URL.";
        }
        else if(!isURL(this.url)){
            this.errorString = "Invalid URL entered.";
        }
        /*else if(this.assetName === "") {
            this.errorString = "Please enter an asset name.";
        }
        else if(!this.verifyExtension(this.ext)){
            this.errorString = "Invalid extension type.";
        }*/
        else{
            this.dispatchEvent(new CustomEvent("confirm"));
            this.remove();
            return;
        }
        this.requestUpdate();
    }

    protected firstConnected()
    {
        super.firstConnected();
        this.classList.add("sv-option-menu", "sv-url-import-menu");
    }

    protected render()
    {
        const typeName = URLImportMenu.dataTypeName.get(this.type) || "${type}";
        return html`
            <div class="ff-flex-column ff-fullsize">
                <div class="ff-flex-row">
                    <div class="ff-flex-spacer ff-title"><b>Import ${typeName}</b></div>
                    <ff-button icon="close" transparent class="ff-close-button" title="Close" @click=${this.close}></ff-button>
                </div>
                <div class="main-content">
                    <div class="ff-splitter-section sv-property-view" style="flex-basis: 70%">
                        <label class="ff-label">URL:</label>
                        <input class="ff-input" type="text"  .value=${this.url} @input=${(e: Event) => this.url = (e.target as HTMLInputElement).value} />
                    </div>
                    <div class="ff-flex-row sv-centered">
                        <ff-button icon="create" class="ff-button ff-control" text="Import ${typeName}" title="Import ${typeName}" @click=${this.confirm}></ff-button>
                    </div>
                    <div class="ff-flex-row sv-centered sv-import-error-msg">
                        <div>${this.errorString}</div>
                    </div>
                </div>
            </div>
        `;
    }
}
