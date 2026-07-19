import { ServiceCategory } from "@yardmatch/contracts";
import { TranslationKey } from "./index";

export const serviceCategoryLabelKeys: Record<ServiceCategory, TranslationKey> = {
  "lawn-mowing": "service.category.lawn_mowing",
  "hedge-trimming": "service.category.hedge_trimming",
  "mulch-installation": "service.category.mulch_installation",
  "seasonal-cleanup": "service.category.seasonal_cleanup",
  "weed-control": "service.category.weed_control",
  "irrigation-check": "service.category.irrigation_check",
  "leaf-blowing": "service.category.leaf_blowing",
  aeration: "service.category.aeration",
  fertilization: "service.category.fertilization",
  "gutter-cleaning": "service.category.gutter_cleaning",
  "snow-shoveling": "service.category.snow_shoveling",
  "ice-melt-salting": "service.category.ice_melt_salting",
  "snow-blowing": "service.category.snow_blowing"
};

export const servicePickerLabelKeys: Partial<Record<ServiceCategory, TranslationKey>> = {
  "lawn-mowing": "service.picker.lawn_mowing",
  "hedge-trimming": "service.picker.hedge_trimming",
  "mulch-installation": "service.picker.mulch_installation",
  "seasonal-cleanup": "service.picker.seasonal_cleanup",
  "weed-control": "service.picker.weed_control",
  "irrigation-check": "service.picker.irrigation_check",
  "gutter-cleaning": "service.picker.gutter_cleaning",
  "ice-melt-salting": "service.picker.ice_melt_salting"
};

export function serviceCategoryToI18nKey(category: ServiceCategory): TranslationKey {
  return serviceCategoryLabelKeys[category];
}
