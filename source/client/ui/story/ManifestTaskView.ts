/**
 * 3D Foundation Project
 * Copyright 2025 Smithsonian Institution
 * * SettingsTaskView.ts
 * 
 * Copyright 2026 SmithIIIF Team
 * * Modified for use with manifest properties
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
import CVManifestTask from "client/components/CVManifestTask";
import Node from "@ff/graph/Node";
import Component from "@ff/graph/Component";
import Property from "@ff/graph/Property";

import "@ff/scene/ui/PropertyView";

import { customElement, property, html, TemplateResult } from "@ff/ui/CustomElement";
import Tree from "@ff/ui/Tree";

import { TaskView } from "client/components/CVTask";
import MainView from "client/ui/story/MainView";
import NVNode from "client/nodes/NVNode";
import { IManifestProvider, ManifestNode, ManifestProps, MultilangProp, isManifestProvider } from "client/utils/ManifestProps";
import ManifestPropMenu from "./ManifestPropMenu";

@customElement("sv-manifest-task-view")
export default class ManifestTaskView extends TaskView<CVManifestTask>
{
    protected handleAddProp(manifestProps: ManifestProps){
        const mainView : MainView = document.getElementsByTagName('voyager-story')[0] as MainView;
        ManifestPropMenu.show(mainView, manifestProps, manifestProps.optionals).then((key) => {
            if(!key || key.length < 0 || manifestProps.has(key)){
                console.warn(`ManifestTaskView.handleAddProp(): Bad key: '${key}'`);
                return;
            }

            const addingProp: ManifestNode = manifestProps.optionals[key] ?? null;
            if(addingProp === null){
                console.warn(`ManifestTaskView.handleAddProp(): Couldn't find data for key: '${key}'`);
                return;
            }

            let obj = {};
            obj[key] = addingProp;
            manifestProps.createFromObject(obj, false, true);

            this.requestUpdate();
            const tree = this.renderRoot.querySelector('sv-manifest-tree');
            if (tree) {
                (tree as any).requestUpdate();
            }

        }).catch(e => {});
    }

    //handles the import of the Manifest json file
    protected handleImportManifest(manifestProps: ManifestProps) {
        const input = this.renderRoot.querySelector('#manifest-file-input') as HTMLInputElement;
        input?.click();
    }

    //reads the json file 
    protected onFileSelected(manifestProps: ManifestProps, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    file.text().then(text => {
        try {
            const json = JSON.parse(text);
            manifestProps.importFromIIIFJSON(json);
            this.requestUpdate();
            const tree = this.renderRoot.querySelector('sv-manifest-tree');
            if (tree) (tree as any).requestUpdate();
        } catch(e) {
            console.error("ManifestTaskView: Failed to parse manifest JSON", e);
        }
        input.value = '';
    });
}

    protected createAddButton(manifestProps: ManifestProps){
        return html`<ff-button icon="create" class="ff-button ff-control" title="Add Property" @click=${() => {this.handleAddProp(manifestProps)}}></ff-button>`;
    }
    protected render()
    {
        if(!this.activeDocument) {
            return;
        }
        const languageManager = this.activeDocument.setup.language;
        //const langSwitch = `<sv-property-view .property=${languageManager.ins.activeLanguage}></sv-property-view>`;
        //TODO: Add translations for this message VVVVV
        const defMsg = html`<div class="sv-placeholder">Please select a node that implements IManifestProvider.</div>`;
        
        let dataKeyCnt = 0;
        let allKeyCnt = 0;
        let node: NVNode | ManifestProps = null;
        let nodes = [];
        let props = null;

        const mainView = document.getElementsByTagName('voyager-story')[0] as MainView;                
        const manifestLevel = mainView.application.manifestLevelProps;
        if(manifestLevel){
            const manifestProps = mainView.application.manifestProps; 
            props = manifestProps;
            props.setLangManager(languageManager);
            dataKeyCnt = Object.keys(props.data).length;
            allKeyCnt = Object.keys(props.base).length + Object.keys(props.optionals).length;
    
            node = props;
        }
        if(!node){
            if(!this.activeNode) {
                return defMsg;
            }
            //Get only nodes with manifest properties
            const nodes = this.activeNode.components.getArray().filter(isManifestProvider);
            //console.log(`Nodes size: ${nodes.length}`);
            node = nodes.length > 0 ? this.activeNode : null; //Need to pass the NVNode to the tree
            //Not a IIIF node
            if(!node) {
                return defMsg;
            }
            //Make manifest properties aware of language manager
            nodes.forEach((node) => {
                node.manifestProps.setLangManager(languageManager);
            });
            props = nodes[0].manifestProps;
            dataKeyCnt = Object.keys(props.data).length;
            allKeyCnt = Object.keys(props.base).length + Object.keys(props.optionals).length;
        }
        return html`<div class="ff-flex-item-stretch ff-scroll-y">
            <sv-property-view .property=${languageManager.ins.activeLanguage}></sv-property-view>
            <input type="file" id="manifest-file-input" accept=".json" style="display:none"
                @change=${(e: Event) => this.onFileSelected(node || props, e)}>
            <sv-manifest-tree .node=${node}></sv-manifest-tree>
            <div class="sv-manifest-actions">
                ${dataKeyCnt < allKeyCnt ? this.createAddButton(props) : null}
                <ff-button icon="document" text="Import" class="ff-button ff-control" title="Import Manifest JSON"
                    @click=${() => this.handleImportManifest(node || props)}></ff-button>
            </div>
        </div>`;
    }
}

////////////////////////////////////////////////////////////////////////////////

interface ITreeNode
{
    id: string;
    children: ITreeNode[];
    text: string;
    classes: string;
    property?: Property;
    buttons?: TemplateResult[]; //TemplateResult is what html`` returns
}

@customElement("sv-manifest-tree")
export class ManifestTree extends Tree<ITreeNode>
{
    @property({ attribute: false })
    node: NVNode | ManifestProps = null;

    protected firstConnected()
    {
        super.firstConnected();
        this.classList.add("ff-property-tree", "sv-manifest-tree");
    }

    protected getClasses(treeNode: ITreeNode)
    {
        return treeNode.classes;
    }

    protected update(changedProperties: Map<PropertyKey, unknown>)
    {
        if (changedProperties.has("node") || this.hasUpdated) {
            this.root = this.createNodeTreeNode(this.node);
        }

        super.update(changedProperties);
    }

    protected renderNodeHeader(node: ITreeNode)
    {
        if (!node.property) {
            return html`<div class="ff-text ff-label ff-ellipsis">${node.text}</div>${node.buttons}`;
        }

        return html`<sv-property-view .property=${node.property}></sv-property-view>`;

    }

    //Helper to create a button for adding elements to array properties
    protected createAddElemButton(path: string, props: ManifestProps){
        return html`<ff-button icon="create" class="iiif-add-btn" title="Add Elem" @click=${(e: MouseEvent) => {e.stopPropagation(); this.handleAddElem(path, props)}}></ff-button>`;
    }

    protected createNodeTreeNode(node: Node | ManifestProps): ITreeNode
    {
        //ManifestProps
        if(node instanceof ManifestProps){
            node.updateAllLangTags();
            //console.log(`${components[0].manifestProps.serialize()}`);
            return {
                id: "THISISANIDTHATWILLNOTCONFLICTWITHNODES",
                text: "Manifest Properties",
                classes: "ff-node",
                children: this.createPropertyNodes(node),
            };
        }
        //NVNode
        const components: (Component & IManifestProvider)[] = node.components.getArray().filter(isManifestProvider);
        //console.log(`${components[0].manifestProps.serialize()}`);
        return {
            id: node.id,
            text: node.displayName,
            classes: "ff-node",
            children: components.map(component => ({
                id: component.id,
                text: component.displayName,
                classes: "ff-component",
                property: null,
                children: this.createPropertyNodes(component.manifestProps),
            })),
        };
    }

    protected createPropertyNodes(properties: ManifestProps): ITreeNode[] {
        //properties.updateAllLangTags();
        const data = properties.data;

        // Helper to recursively build the tree from the ManifestNode data
        const buildTree = (obj: ManifestNode, path: string): ITreeNode[] => {
            if (typeof obj !== 'object' || obj === null || obj instanceof MultilangProp) {
                return [];
            }

            return Object.entries(obj).map(([key, value]) => {
                const currentPath = path === "" ? key : `${path}.${key}`;
                const isLeaf = !(typeof value === 'object' && !(value instanceof MultilangProp));
                
                return {
                    id: currentPath,
                    text: key,
                    classes: isLeaf ? "ff-property" : "ff-group",
                    // If it's a leaf, look up the UI Property we registered earlier
                    property: isLeaf ? properties.getUIProperty(currentPath) : null,
                    // Recursively build children
                    children: buildTree(value as ManifestNode, currentPath),
                    // If this is an array, add a button to add elements
                    buttons: Array.isArray(value) ? [this.createAddElemButton(currentPath, properties)] : null
                };
            });
        };

        return buildTree(data, "");
    }

    // Handle adding an element to an array property
    protected handleAddElem(path: string, props: ManifestProps){
        if(!path || path.length === 0){
            console.warn("ManifestTree.handleAddElem(): path is empty");
            return;
        }
        if(!props){
            console.warn("ManifestTree.handleAddElem(): props is null");
            return;
        }

        props.addElemToArray(path);
        this.requestUpdate();
    }
}
