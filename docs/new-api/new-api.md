# 0 New API Specification
   C:\Users\dwolf\Downloads\pqs-designs\front-end\idlookup-app-updated\docs\new-api\bc client library - API.csv

# 1 Add LIbraries "  <script src=""<https://cdn.jsdelivr.net/npm/axios@1.13.2/dist/axios.min.js"">></script>
  <script src=""https://dev1.dev.www.bytecrtrs.com/libs/api-wrapper/index.iife.js""></script>"

# 2 configure the library 
  const apiWrapper = window.ApiWrapper.getInstance({ endpointUrl: '<https://dev1.dev.www.bytecrtrs.com/api>' }); 

# 4 Dev Captcha
Dev Captcha Pass bcEdgeApiPass

# 5 Sample Page
Sample page <https://dev1.dev.www.bytecrtrs.com/test/development.html>   

# 6 Sample API usage in JavaScript
Example search teaser 
"
    apiWrapper.api.idLookup.searchTeaser(query).then((e) => {
    console.log('searchTeaser response', e);

    const identities = e.getIdentities();

    if (!identities?.length) {
      return;
    }

    const ul = document.createElement('ul');

    function pushIdentities(identity) {
      const li = document.createElement('li');
      li.innerText = `${identity.nameList[0].data} : ${identity.addressList.map((e) => e.state).join(', ')}`;
      li.style.cursor = 'pointer';
      li.onclick = () => {
        const reportClickType = document.getElementById('report-click-type').value;

        if (reportClickType === 'createReport') {
          apiWrapper.api.idLookup.createReport({
            type: 'extId',
            extId: identity.extId,
            searchContextKey,
            teaserInput: e.getTeaserInput(),
          });
        } else if (reportClickType === 'requestOptOut') {
          apiWrapper.api.optOut.request({
            extId: identity.extId,
            provider: e.getIdiRaw().meta.provider,
            email: 'dev@forserver.net',
            fullName: 'test optout',
            address: 'test addresss 123',
            phone: '8054320540',
            referenceId: e.getCommerceContent()._id,
          });
        }
      };
      ul.append(li);
    }
"
