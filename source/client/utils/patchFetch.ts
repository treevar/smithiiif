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

let ogFetch: typeof fetch = window.fetch.bind(window);
let defaultProxyUrl: string = "https://iiif-proxy.github-316.workers.dev/?url=";
//Can be IP or URL
let proxyUrl: string = "";
//Options sent to the proxy
let proxyOptions: RequestInit = {
    "method": "GET"
};

//We try the proxy if ogFetch has any of the status codes below
//401: Unauthorized (Most of the time)
//403: Forbidden
//404: Not Found (used if server operator doesnt want to expose files they have)
// *Will add load to proxy as we can't tell if the resource exist or not
const proxyHttpCodes = [401, 403];

//Returns whether the url is valid
export function isURL(url: string){
    try{
        let u = new URL(url);
        return true;
    }
    catch(e){
        return false;
    }
}

//Adds CORS support
//Process the request through our proxy
export function proxiedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>{
    if(proxyUrl.length === 0){
        return Promise.reject(new Error("proxiedFetch called and proxyUrl not set"));
    }
    let url: string = input instanceof URL ? input.toString() : input instanceof Request ? input.url : input;
    const isLocal = 
        url.includes("localhost") || 
        url.includes("127.0.0.1") || 
        url.includes("[::1]") || 
        url.includes(".local");

    // 2. If local, or if it's NOT a Smithsonian/IIIF asset, bypass proxy
    if (isLocal) {
        return ogFetch(input, init);
    }
    //Format for sending
    url = encodeURIComponent(url);
    url = proxyUrl + url;
    //Retain all options from original request and add proxy options, proxy options will override any conflicting options from init
    const opts: RequestInit = {
        ...init,
        ...proxyOptions
    };
    return ogFetch(url, opts);
}

//Adds CORS support
//First tries to fetch without proxy, if that fails bcs of CORS then we try the proxy
export function smartFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>{
    //Cant fetch
    if(!ogFetch){
       return Promise.reject(new Error("ogFetch not set, must call patchFetch before calling smartFetch"));
    }
    //return ogFetch(input, init);
    //Proxy only handles GET
    if(init){
        if(init.method && init.method !== "GET"){
            return ogFetch(input, init);
        }
    }
    return new Promise((resolve, reject) => {
        //Try ogFetch
        ogFetch(input, init).then((res) => {
            if(res.ok){ resolve(res); } //Normal fetch worked
            else{
                if(proxyHttpCodes.includes(res.status)){
                    return resolve(proxiedFetch(input, init));
                }
            }
            //Code not handled by proxy, return ogFetch res
            return resolve(res);
        }).catch((err: TypeError) => { //Could be net failure
            if(!window.navigator.onLine){
                console.warn("smartFecth(): Network disconnected");
                return reject(new Error("Network Disconnected"));
            }
            return resolve(proxiedFetch(input, init));
        }) 
    });
}

//Sets windows.fetch = smartFetch
//If newProxyUrl is invalid then nothing happens
//If headers are supplied then they are sent to the proxy
//Will only proxy GET requests
export default function patchFetch(newProxyUrl: string = defaultProxyUrl, headers?: HeadersInit){
    if(!isURL(newProxyUrl)){
        console.error("patchFetch(): Bad proxy URL");
        return;
    }
    if(headers){
        proxyOptions['headers'] = headers;
    }
    //ogFetch = window.fetch;
    proxyUrl = newProxyUrl;
    window.fetch = smartFetch;
}
