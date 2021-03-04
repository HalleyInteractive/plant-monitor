var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/// <reference path='./github-releases.d.ts'/>
import axios from 'axios';
class GitHubReleases {
    constructor(elementId) {
        this.htmlSelect = null;
        this.loaded = false;
        this.releases = new Map();
        this.requiredBinaries = new Set([
            'bootloader.bin',
            'partition-table.bin',
            'program.bin'
        ]);
        this.htmlSelect = document.getElementById(elementId);
        if (this.htmlSelect) {
            const repo = this.htmlSelect.getAttribute('repo');
            const owner = this.htmlSelect.getAttribute('owner');
            this.getReleases(owner, repo).then((releases) => {
                this.releases = releases;
                this.loaded = true;
                this.populateSelect(this.htmlSelect, this.releases);
            });
        }
    }
    populateSelect(htmlSelect, releases) {
        if (!htmlSelect) {
            return;
        }
        for (const [id, release] of releases.entries()) {
            const option = document.createElement('option');
            option.value = id.toString(10);
            option.textContent = `${release.tag_name} - ${release.name}`;
            htmlSelect.append(option);
        }
    }
    getValidReleases(releases) {
        const validReleases = new Map();
        for (const { id, name, tag_name, draft, assets } of releases) {
            const binaries = this.getReleaseBinaries(assets);
            if (!binaries) {
                console.log(`No valid binaries found in ${name}.`);
                continue;
            }
            validReleases.set(id, { name, tag_name, draft, binaries });
        }
        return validReleases;
    }
    getReleaseBinaries(releaseAssets) {
        const assets = new Map();
        for (const asset of releaseAssets) {
            const { name, browser_download_url } = asset;
            if (this.requiredBinaries.has(name)) {
                assets.set(name, browser_download_url);
            }
        }
        if (assets.size === this.requiredBinaries.size) {
            return assets;
        }
        return null;
    }
    getReleases(owner, repo) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
            const repsonse = yield fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            const releases = yield repsonse.json();
            const validReleases = this.getValidReleases(releases);
            return validReleases;
        });
    }
    downloadSelectedRelease() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const selectedRelease = (_a = this.htmlSelect) === null || _a === void 0 ? void 0 : _a.value;
            const repo = this.htmlSelect.getAttribute('repo');
            const owner = this.htmlSelect.getAttribute('owner');
            if (!selectedRelease) {
                return null;
            }
            return this.downloadRelease(owner, repo, parseInt(selectedRelease, 10));
        });
    }
    downloadRelease(owner, repo, releaseId) {
        return __awaiter(this, void 0, void 0, function* () {
            const binMap = new Map();
            const release = this.releases.get(releaseId);
            if (!release) {
                return null;
            }
            for (const [name, browserUrl] of release.binaries.entries()) {
                // console.log(`Getting release asset: ${name} - ${assetId}`);
                // const url = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${assetId}`;
                axios({
                    method: 'get',
                    url: browserUrl,
                    responseType: 'stream'
                }).then((response) => {
                    console.log(response);
                });
                const url = `${browserUrl}`;
                console.log(url);
                const response = yield fetch(url, {
                    headers: {
                        'accept': 'application/octet-stream',
                        'user-agent': ''
                    }
                });
                console.log(response);
                const binary = yield response.arrayBuffer();
                binMap.set(name, new Uint8Array(binary));
            }
            return binMap;
        });
    }
}
//# sourceMappingURL=github-releases.js.map