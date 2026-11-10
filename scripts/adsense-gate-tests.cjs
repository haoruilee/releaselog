const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {canRequestAds}=require(path.join(process.env.COMPILED_TEST_LIBS,'lib/adsense-gate.js'));
const shipped=require('../publisher-config.json');
const enabled={adsense:{enabled:true,clientId:'ca-pub-1234567890123456',consentIntegration:'google_certified_cmp',slots:{'home-banner':'1234567890'}}};
test('shipped config never requests ads even when consent is granted',()=>assert.equal(canRequestAds(shipped,'home-banner','granted').ok,false));
test('publisher, slot and consent are each required',()=>{
 assert.equal(canRequestAds(enabled,'home-banner','granted').ok,true);
 for(const change of [{enabled:false},{clientId:'invalid'},{slots:{}},{consentIntegration:'not_configured'}])assert.equal(canRequestAds({adsense:{...enabled.adsense,...change}},'home-banner','granted').ok,false);
 for(const consent of [undefined,null,false,'denied'])assert.equal(canRequestAds(enabled,'home-banner',consent).ok,false);
});
