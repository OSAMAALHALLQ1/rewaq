export const DEFAULT_TENANT_ID = 'taka-main';

let currentTenantId = localStorage.getItem('taka_tenant_id') || DEFAULT_TENANT_ID;

export const getTenantId = () => currentTenantId;

export const setTenantId = (id) => {
  if (id) {
    currentTenantId = id;
    localStorage.setItem('taka_tenant_id', id);
  } else {
    currentTenantId = DEFAULT_TENANT_ID;
    localStorage.removeItem('taka_tenant_id');
  }
};
