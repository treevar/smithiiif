/**
 * 3D Foundation Project
 * Copyright 2025 Smithsonian Institution
 * * ImportMenu.ts
 * 
 * Copyright 2026 SmithIIIF Team
 * * Modified for use in adding additional properties to a ManifestProps
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
import { ManifestNode, ManifestProps } from "client/utils/ManifestProps";
import { Dictionary } from "@ff/core/types";

////////////////////////////////////////////////////////////////////////////////

@customElement("sv-manifest-prop-menu")
export default class ManifestPropMenu extends Popup
{
    protected propKeySelection: string = "";
    protected errorString: string = "";
    protected dataString: string = ""

    protected options: Dictionary<ManifestNode> = null;
    protected readonly manifestProps: ManifestProps = null;

    static show(parent: HTMLElement, manifestProps: ManifestProps, properties: Dictionary<ManifestNode>): Promise<string>
    {
        const menu = new ManifestPropMenu(manifestProps, properties);
        parent.appendChild(menu);

        return new Promise((resolve, reject) => {
            menu.on("confirm", () => resolve(menu.propKeySelection));
            menu.on("close", () => reject());
        });
    }

    constructor(manifestProps: ManifestProps, properties: Dictionary<ManifestNode>)
    {
        super();
        this.manifestProps = manifestProps;
        this.options = properties;
        this.position = "center";
        this.modal = true;
    }

    close()
    {
        this.dispatchEvent(new CustomEvent("close"));
        this.remove();
    }

    confirm()
    {
        if(this.propKeySelection == "") {
            this.errorString = "Please select property.";
            this.requestUpdate();
        }
        else {
            this.dispatchEvent(new CustomEvent("confirm"));
            this.remove();
        }
    }

    protected firstConnected()
    {
        super.firstConnected();
        this.classList.add("sv-option-menu", "sv-manifest-prop-menu");
    }

    protected renderPropEntry(key: string)
    {
        return html`<div class="sv-entry" @click=${(e: MouseEvent) => this.onClickProp(e, key)} ?selected=${ key === this.propKeySelection }>
            ${key}
        </div>`;
    }

    protected render()
    {
        //console.warn(`Object keys: ${Object.keys(this.options).length}`)
        return html`
            <div class="ff-flex-column ff-fullsize">
                <div class="ff-flex-row">
                    <div class="ff-flex-spacer ff-title"><b>Add Property</b></div>
                    <ff-button icon="close" transparent class="ff-close-button" title="Close" @click=${this.close}></ff-button>
                </div>
                <div class="ff-flex-row">
                    <div class="ff-flex-spacer ff-header">Select Property:</div>
                </div>
                <div class="ff-splitter-section" style="flex-basis: 70%">
                    <div class="ff-scroll-y">
                        ${this.getNonAddedProps().map((key) => this.renderPropEntry(key))}
                    </div>
                </div>
                <div class="ff-flex-row">
                    <div class="ff-flex-spacer ff-header">Data</div>
                </div>
                <div class="ff-flex-row sv-centered">
                    <div>${this.dataString}</div>
                </div>
                <div class="ff-flex-row sv-centered">
                    <ff-button icon="create" class="ff-button ff-control" text="Add Property" title="Add Property" @click=${this.confirm}></ff-button>
                </div>
                <div class="ff-flex-row sv-centered sv-import-error-msg">
                    <div>${this.errorString}</div>
                </div>
            </div>
        `;
    }

    protected onClickProp(e: MouseEvent, key: string)
    {
        e.stopPropagation();

        this.propKeySelection = key;
        this.dataString = `"${key}": ${JSON.stringify(this.options[key])}`;
        this.requestUpdate();
    }

    protected getNonAddedProps(): string[]{
        let props: string[] = [];
        const curProps = Object.keys(this.manifestProps.data);
        Object.keys(this.options).forEach((key) => {
            let i = 0
            for(; i < curProps.length; ++i){
                if(key === curProps[i]){
                    break;
                }
            }
            if(i >= curProps.length){
                props.push(key);
            }
        });
        return props;
    }

    protected getDataString(node: ManifestNode): string{
        let out = "";
        if(Array.isArray(node)){
            out += "["
            node.forEach((val) => {
                out += `${this.getDataString(val)},`;
            });
            out += "]";
        }
        return out;
    }
}
