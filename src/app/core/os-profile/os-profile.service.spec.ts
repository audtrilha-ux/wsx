import { TestBed } from '@angular/core/testing';
import { OsProfileService } from './os-profile.service';
import { AppProfileRegistryService } from '../app-runtime/app-profile-registry.service';

describe('OsProfileService & Operational Modes (Varejo x Restaurantes)', () => {
  let profileService: OsProfileService;
  let registryService: AppProfileRegistryService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [OsProfileService, AppProfileRegistryService]
    });

    profileService = TestBed.inject(OsProfileService);
    registryService = TestBed.inject(AppProfileRegistryService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should default to retail profile if no stored preference exists', () => {
    expect(profileService.activeProfile()).toBe('retail');
    expect(profileService.currentProfileDef().id).toBe('retail');
  });

  it('should switch to restaurant profile and persist in storage', () => {
    profileService.setProfile('restaurant');
    expect(profileService.activeProfile()).toBe('restaurant');
    expect(profileService.currentProfileDef().name).toBe('Modo Restaurantes & Gastronomia');
    expect(localStorage.getItem('3eatcru_os_profile')).toBe('restaurant');
  });

  it('should provide the exact confirmed pre-installed suite for Retail mode', () => {
    const retailApps = registryService.getAppsForProfile('retail');
    const retailIds = retailApps.map(a => a.id);

    expect(retailIds).toContain('app_pos');
    expect(retailIds).toContain('app_inventory');
    expect(retailIds).toContain('app_crm');
    expect(retailIds).toContain('app_telegram');
    expect(retailApps.length).toBe(4);
  });

  it('should provide the exact confirmed pre-installed suite for Restaurant mode', () => {
    const restaurantApps = registryService.getAppsForProfile('restaurant');
    const restaurantIds = restaurantApps.map(a => a.id);

    expect(restaurantIds).toContain('app_tables');
    expect(restaurantIds).toContain('app_finance');
    expect(restaurantIds).toContain('app_pos');
    expect(restaurantIds).toContain('app_inventory');
    expect(restaurantApps.length).toBe(4);
  });
});
