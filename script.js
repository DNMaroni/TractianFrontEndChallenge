
const api = 'https://fake-api.tractian.com';
let companies = {};
let rendererStack = [];
var filterEnergy = false;
var filterCritical = false;
var currentCompanyId = null;
var filterByName = '';

function loadCompanies() {
    fetch(api+'/companies')
    .then(response => {
        if (!response.ok) {
          throw new Error('Error: ' + response.status);
        }
        return response.json();
      })
      .then(data => {
        renderCompanies(data);
      })
      .catch(error => {
        console.error('Erro:', error);
      });
}

function renderCompanies(companies){

    var companiesRender = document.getElementById('companies_render');
    
    for(var index in companies){
        
        var companie = companies[index];

        const companie_button = document.createElement("div");
        
        companie_button.innerHTML = `
            <button class="companies-button" id="${companie.id}" onclick="loadCompanyData(this.id); changeCompanyName('${companie.name}'); changeCompaniesButtonSelectionColor(this);">
                <div class="companies-icon">
                    <img src="assets/icons/boxes.png" alt="Boxes icon">
                </div>
                <div class="companies-name">
                    ${companie.name} Unit
                </div>
            </button>
        `;

        companiesRender.appendChild(companie_button);
    }

}

function changeCompaniesButtonSelectionColor(button){
    const companiesButtons = document.querySelectorAll(".companies-button");
    companiesButtons.forEach(btn => btn.classList.remove("companies-button-active"));
    button.classList.toggle("companies-button-active");
}

function changeFiltersButtonSelectionColor(button, type){
    button.classList.toggle("filter-button-active");

    if(type == 'energy'){
        filterEnergy = !filterEnergy;
    }else{
        filterCritical = !filterCritical;
    }

    if(currentCompanyId != null){
        renderTree(currentCompanyId);
    }
}

function changeCompanyName(companie){
    var companyNameElement = document.getElementById('select_unit_name');
    companyNameElement.textContent = ' / '+companie+' Unit';
}

function loadCompanyData(companyID) {

    if (companies[companyID] !== undefined) {
        renderTree(companyID);
        return;
    }

    const locationUrl = `${api}/companies/${companyID}/locations`;
    const assetUrl = `${api}/companies/${companyID}/assets`;

    Promise.all([fetch(locationUrl), fetch(assetUrl)])
        .then(responses => {
            responses.forEach(response => {
                if (!response.ok) {
                    throw new Error('Error: ' + response.status);
                }
            });
            return Promise.all(responses.map(response => response.json()));
        })
        .then(([locationsData, assetsData]) => {
            companies[companyID] = {
                locations: locationsData,
                assets: assetsData
            };

            renderTree(companyID);
        })
        .catch(error => {
            console.error('Erro:', error);
        });
}

function filterTree(nodes, predicate, includeAllChildrenOnMatch = false) {
    return nodes.reduce((filtered, node) => {
        const filteredChildren = filterTree(node.children || [], predicate, includeAllChildrenOnMatch);
        const filteredAssets = filterTree(node.assets || [], predicate, includeAllChildrenOnMatch);

        const isMatch = predicate(node);
        const hasMatchingDescendants = filteredChildren.length > 0 || filteredAssets.length > 0;

        if (isMatch || hasMatchingDescendants) {
            filtered.push({
                ...node,
                children: isMatch && includeAllChildrenOnMatch ? node.children : filteredChildren,
                assets: isMatch && includeAllChildrenOnMatch ? node.assets : filteredAssets,
            });
        }

        return filtered;
    }, []);
}

function filterTreeByName(inputValue){

    filterByName = inputValue;

    if(currentCompanyId != null){
        renderTree(currentCompanyId);
    }
}

function renderTree(companyID){

    currentCompanyId = companyID;

    var locations = companies[companyID]['locations'];
    var assets = companies[companyID]['assets'];
    
    let tree = [];
    let unlinkedAssets = [];
    let unlinkedLocations = [];

    const locationMap = {};
    locations.forEach(location => {
        locationMap[location.id] = { ...location, children: [], assets: [] };
    });

    locations.forEach(location => {
        if (location.parentId) {
            locationMap[location.parentId].children.push(locationMap[location.id]);
        } else {
            tree.push(locationMap[location.id]);
        }
    });

    const assetMap = {};

    assets.forEach(asset => {
        assetMap[asset.id] = { ...asset, children: [] };

        if (asset.locationId) {
            locationMap[asset.locationId].assets.push(assetMap[asset.id]);
        } else if (!asset.parentId) {
            unlinkedAssets.push(assetMap[asset.id]);
        }
    });

    assets.forEach(asset => {
        if (asset.parentId && assetMap[asset.parentId]) {
            assetMap[asset.parentId].children.push(assetMap[asset.id]);
        }
    });

    Object.values(locationMap).forEach(location => {
        if (location.children.length === 0 && location.assets.length === 0) {
            unlinkedLocations.push(location);
            tree = tree.filter(item => item.id !== location.id);
        }
    });


    unlinkedLocations.forEach(location => {
        tree.push(location);
    });

    unlinkedAssets.forEach(asset => {
        tree.push(asset);
    });

    if(filterCritical || filterEnergy){
        tree = filterTree(tree, node => ("sensorType" in node && ((node.sensorType == 'vibration' && node.status == 'alert' && filterCritical) || (node.sensorType == 'energy' && filterEnergy))));
    } 

    if(filterByName != '') tree = filterTree(tree, node => ("name" in node && node.name.toLowerCase().includes(filterByName.toLowerCase())), true);
    

    var divRenderer = document.createElement('div');

    tree.forEach(element => {

        var htmlElement = createHtmlElement(element, 0);

        if("children" in element && Array.isArray(element.children) && element.children.length > 0){
            processNodes(element.children, htmlElement, 1);
        }

        if("assets" in element && Array.isArray(element.assets) && element.assets.length > 0){
            processNodes(element.assets, htmlElement, 1);
        }

        divRenderer.appendChild(htmlElement);
    });

    var htmlRender = document.getElementById('tree_renderer');
    htmlRender.innerHTML = '';
    htmlRender.appendChild(divRenderer);
}

function clearRightContent(){
    var rightContentElement = document.getElementById('content_renderer');
    rightContentElement.innerHTML = '';
}

function renderContent(element){
    var rightContentElement = document.getElementById('content_renderer');

    clearRightContent();

    subSection = '';

    if("status" in element && element.sensorId !== undefined){
        subSection = `
            <hr>
            <div class="r-content-down-col">
                <div class="r-content-down-left">
                    <p class="r-content-title-small">Sensor</p>
                    <p><img src="assets/icons/sensor.png" alt="Sensor icon"> ${element.sensorId}</p>
                </div><div class="r-content-down-right">
                    <p class="r-content-title-small">Receptor</p>
                    <p><img src="assets/icons/router.png" alt="Router icon"> ${element.gatewayId}</p>
                </div>
            </div>
        `;
    }

    var informationElements = '';

    if("status" in element){
        informationElements = `
            <p class="r-content-title-small">Tipo de equipamento</p>
            <p><img src="assets/icons/warning.png" alt="Warning icon"> Sem informação</p>
            <hr>
            <p class="r-content-title-small">Responsáveis</p>
            <p><img src="assets/icons/warning.png" alt="Warning icon"> Sem informação</p>
        `;
    }else{
        informationElements = `
        <p class="r-content-title-small">Location ID</p>
        <p><img src="assets/icons/warning.png" alt="Warning icon"> ${element.id}</p>
        `;
    }

    var newElement = document.createElement('div');
    newElement.innerHTML = `
        <div class="r-content-title">
            <h2 class="${getStatusClass(element)}">${element.name}</h2>
        </div>
        <hr>
        <div class="r-content">
            <div class="r-content-col">
                <div class="r-content-col-left">
                </div>
                <div class="r-content-col-right">
                    ${informationElements}
                </div>
            </div>
        ${subSection}
        </div>
    `;

    rightContentElement.appendChild(newElement);
}

function getStatusClass(element){

    if("sensorType" in element && element.sensorType !== null){
        if(element.sensorType && element.sensorType == 'energy'){
           return 'after-bolt';
        }
    
        if(element.status == 'alert' && element.sensorType == 'vibration'){
            return 'after-red-ball';
        }
    
        if(element.status == 'operating' && element.sensorType == 'vibration'){
            return 'after-green-ball';
        }
    }

    return '';
}

function createHtmlElement(element, depth){

    if("sensorType" in element && element.sensorType !== null){
        
        var li = document.createElement('li');
        li.tabIndex = 0;

        li.classList.add(getStatusClass(element));

        var image = '<img src="assets/icons/component.png" alt="Component icon">';
        li.innerHTML = `&nbsp;${image} ${element.name}`;
        li.style.marginLeft = `${depth * 25}px`;

        li.setAttribute('onclick', 'renderContent('+JSON.stringify(element)+')');

        return li;
    }
    else if("status" in element && element.children.length == 0){
        
        var image = '<img src="assets/icons/asset.png" alt="Asset icon">';
        var li = document.createElement('li');
        li.tabIndex = 0;
        li.innerHTML = `&nbsp;${image} ${element.name}`;

        li.style.marginLeft = `${depth * 20}px`;

        li.setAttribute('onclick', 'renderContent('+JSON.stringify(element)+')');

        return li;

    }else if("status" in element && element.children.length > 0){
        
        var image = '<img src="assets/icons/asset.png" alt="Asset icon">';
        var details = document.createElement('details');
        var summary = document.createElement('summary');
        summary.innerHTML = `&nbsp;${image} ${element.name}`;

        summary.style.marginLeft = `${depth * 20}px`;

        summary.setAttribute('onclick', 'renderContent('+JSON.stringify(element)+')');


        details.appendChild(summary);

        return details;

    }else if("children" in element && "assets" in element && (element.children.length > 0 || element.assets.length > 0)){

        var image = '<img src="assets/icons/location.png" alt="Location icon">';

        var details = document.createElement('details');
        var summary = document.createElement('summary');
        summary.innerHTML = `&nbsp;${image} ${element.name}`;
        summary.style.marginLeft = `${depth * 20}px`;

        summary.setAttribute('onclick', 'renderContent('+JSON.stringify(element)+')');

        details.appendChild(summary);

        return details;
    
    }else{

        var image = '<img src="assets/icons/location.png" alt="Location icon">';
        var li = document.createElement('li');
        li.tabIndex = 0;
        li.innerHTML = `&nbsp;${image} ${element.name}`;
        li.style.marginLeft = `${depth * 20}px`;

        li.setAttribute('onclick', 'renderContent('+JSON.stringify(element)+')');

        return li;
    }
}

function processNodes(nodes, parentElement, depth) {
    nodes.forEach(node => {
        
        const htmlElement = createHtmlElement(node, depth);

        parentElement.appendChild(htmlElement);

        if ("children" in node && Array.isArray(node.children) && node.children.length > 0) {
            processNodes(node.children, htmlElement, depth + 1);
        }

        if ("assets" in node && Array.isArray(node.assets) && node.assets.length > 0) {
            processNodes(node.assets, htmlElement, depth + 1);
        }

    });
}

document.addEventListener("DOMContentLoaded", function() {
    loadCompanies();

    const input = document.getElementById("text_filter_input");
    let timer;
    const delay = 600;

    input.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            filterTreeByName(input.value);
        }, delay);
    });
});