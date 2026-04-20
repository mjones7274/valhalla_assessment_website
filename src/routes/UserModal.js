import React, { useState, useEffect } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import Detail from "./Detail"; // or inline if you want
import { apiRequest } from "../api";
import "./Users.css";

const API_URL = `${process.env.REACT_APP_API_URL_BASE}/api/users/`;
const COMPANIES_URL = `${process.env.REACT_APP_API_URL_BASE}/api/companies/`;
const USER_TYPES_URL = `${process.env.REACT_APP_API_URL_BASE}/api/user-types/`;
const PHONE_TYPES_URL = `${process.env.REACT_APP_API_URL_BASE}/api/phone-types/`;
const ADDRESS_TYPES_URL = `${process.env.REACT_APP_API_URL_BASE}/api/address-types/`;
const USER_PHONES_URL = `${process.env.REACT_APP_API_URL_BASE}/api/user-phones/`;
const USER_ADDRESSES_URL = `${process.env.REACT_APP_API_URL_BASE}/api/user-addresses/`;
const COMPANY_USERS_URL = `${process.env.REACT_APP_API_URL_BASE}/api/company-users/`;

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" },
];

const COUNTRY_OPTIONS = ["United States", "Canada", "Mexico"];

const normalizePhoneDigits = (value) => String(value ?? "").replace(/\D/g, "");

const formatPhoneForInput = (value) => {
  const digits = normalizePhoneDigits(value);

  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)} ${digits.slice(10)}`;
};

const getResponseErrorMessage = async (response) => {
  try {
    const data = await response.json();
    if (typeof data === "string") return data;
    return JSON.stringify(data);
  } catch {
    return `status ${response.status}`;
  }
};

const getAddressRowKey = (address) => address?.user_address_id ?? address?.id;
const getPersistedAddressId = (address) =>
  address?.user_address_id ?? address?.id ?? null;
const getCompanyRowKey = (company) =>
  company?.company_user_id ??
  company?.company_patient_id ??
  company?.company_id ??
  company?.company?.company_id ??
  null;
const getCompanyId = (company) =>
  Number(company?.company_id ?? company?.company?.company_id ?? 0);
const getCompanyUserLinkId = (companyUser) =>
  companyUser?.company_user_id ?? companyUser?.id ?? null;
const getCompanyUserUserId = (companyUser) => Number(
  companyUser?.user_id ??
  companyUser?.web_user ??
  companyUser?.user?.user_id ??
  0
);
const getCompanyUserCompanyId = (companyUser) => Number(
  companyUser?.company_id ??
  companyUser?.company?.company_id ??
  0
);
const getPhoneRowKey = (phone) =>
  phone?.user_phone_id ??
  phone?.id ??
  phone?.phone_id ??
  null;

const getPersistedPhoneId = (phone) =>
  phone?.user_phone_id ??
  phone?.id ??
  null;

const getPhoneUserId = (phone) => Number(
  phone?.web_user ??
  phone?.web_user_id ??
  phone?.user_id ??
  phone?.web_user?.user_id ??
  phone?.user?.user_id ??
  0
);

const getAddressUserId = (address) => Number(
  address?.web_user ??
  address?.web_user_id ??
  address?.user_id ??
  address?.web_user?.user_id ??
  address?.user?.user_id ??
  0
);

const formatUserTypeLabel = (value) =>
  String(value ?? "")
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const MIN_INITIAL_PASSWORD_LENGTH = 12;
const MAX_INITIAL_PASSWORD_LENGTH = 20;

const PASSWORD_WORD_BANK = [
  "amber", "anchor", "apricot", "arrow", "atlas", "aurora",
  "bamboo", "beacon", "birch", "blossom", "breeze", "brook",
  "canyon", "cedar", "comet", "coral", "crystal", "dawn",
  "ember", "falcon", "fern", "forest", "glacier", "harbor",
  "hazel", "horizon", "island", "jasmine", "lagoon", "lantern",
  "maple", "meadow", "mist", "nova", "oasis", "orchid",
  "pebble", "pine", "prairie", "quartz", "raven", "river",
  "saffron", "sage", "sierra", "solar", "spruce", "summit",
  "thunder", "timber", "topaz", "valley", "violet", "willow",
  "zephyr",
];

const getCryptoRandomInt = (maxExclusive) => {
  if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) return 0;

  const cryptoObj = typeof window !== "undefined" ? window.crypto : null;
  if (!cryptoObj?.getRandomValues) {
    return Math.floor(Math.random() * maxExclusive);
  }

  const randomArray = new Uint32Array(1);
  cryptoObj.getRandomValues(randomArray);
  return randomArray[0] % maxExclusive;
};

const generateDictionaryStylePassword = (
  minLength = MIN_INITIAL_PASSWORD_LENGTH,
  maxLength = MAX_INITIAL_PASSWORD_LENGTH
) => {
  const normalizedMin = Number.isFinite(minLength) ? Math.max(1, Math.floor(minLength)) : 12;
  const normalizedMax = Number.isFinite(maxLength)
    ? Math.max(normalizedMin, Math.floor(maxLength))
    : 20;

  const separators = ["", "-", "_"];
  const toTitleCase = (word) => word.charAt(0).toUpperCase() + word.slice(1);

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const wordCount = getCryptoRandomInt(2) + 2; // 2-3 words
    const separator = separators[getCryptoRandomInt(separators.length)];

    const words = Array.from({ length: wordCount }, () => {
      const randomWord = PASSWORD_WORD_BANK[getCryptoRandomInt(PASSWORD_WORD_BANK.length)];
      return toTitleCase(randomWord);
    });

    const basePhrase = words.join(separator);
    const suffix = getCryptoRandomInt(100) < 70
      ? String(getCryptoRandomInt(100)).padStart(2, "0")
      : "";
    const candidate = `${basePhrase}${suffix}`;

    if (candidate.length >= normalizedMin && candidate.length <= normalizedMax) {
      return candidate;
    }
  }

  return "WillowRiver12";
};

const UserModal = ({ mode, user, onClose, onSaved, onUserUpdated }) => {
  const isEdit = mode === "edit" || mode === "add";

  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [initialPassword, setInitialPassword] = useState(
    mode === "add" ? generateDictionaryStylePassword() : ""
  );
  const [isActive, setIsActive] = useState(user?.is_active ?? true);
  const [userTypeId, setUserTypeId] = useState(user?.user_type?.user_type_id || "");
  const [companies, setCompanies] = useState(user?.companies || []);
  const [phones, setPhones] = useState(user?.phones || []);
  const [addresses, setAddresses] = useState(user?.addresses || []);
  const [lastLogin] = useState(user?.last_login || "");

  const [allCompanies, setAllCompanies] = useState([]);
  const [userTypes, setUserTypes] = useState([]);
  const [phoneTypes, setPhoneTypes] = useState([]);
  const [addressTypes, setAddressTypes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [isCompaniesOpen, setIsCompaniesOpen] = useState(true);
  const [isPhonesOpen, setIsPhonesOpen] = useState(true);
  const [isAddressesOpen, setIsAddressesOpen] = useState(false);
  const [editingAddressKey, setEditingAddressKey] = useState(null);
  const [editingPhoneKey, setEditingPhoneKey] = useState(null);
  const [isDeleteAddressOpen, setIsDeleteAddressOpen] = useState(false);
  const [isDeletePhoneOpen, setIsDeletePhoneOpen] = useState(false);
  const [deletingAddressKey, setDeletingAddressKey] = useState(null);
  const [deletingPhoneKey, setDeletingPhoneKey] = useState(null);
  const [initialCompanyIds, setInitialCompanyIds] = useState([]);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [newCompanyId, setNewCompanyId] = useState("");
  const [companyModalError, setCompanyModalError] = useState("");
  const [showUserTypeModal, setShowUserTypeModal] = useState(false);
  const [draftUserTypeId, setDraftUserTypeId] = useState("");
  const [userTypeModalError, setUserTypeModalError] = useState("");
  const [newPhoneData, setNewPhoneData] = useState({
    phone: "",
    phone_type_id: "",
  });
  const [newAddressData, setNewAddressData] = useState({
    street_1: "",
    street_2: "",
    city: "",
    st: "",
    zip: "",
    country: "United States",
    address_type_id: "",
  });

  const loadRelatedPhonesAndAddresses = async (targetUserId) => {
    const normalizedUserId = Number(targetUserId);
    if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return;

    const [phonesRes, addressesRes] = await Promise.all([
      apiRequest(USER_PHONES_URL),
      apiRequest(USER_ADDRESSES_URL),
    ]);

    const phonesPayload = await phonesRes.json();
    const addressesPayload = await addressesRes.json();

    const phoneRows = Array.isArray(phonesPayload)
      ? phonesPayload
      : Array.isArray(phonesPayload?.results)
        ? phonesPayload.results
        : [];

    const addressRows = Array.isArray(addressesPayload)
      ? addressesPayload
      : Array.isArray(addressesPayload?.results)
        ? addressesPayload.results
        : [];

    const filteredPhones = phoneRows
      .filter((phone) => getPhoneUserId(phone) === normalizedUserId)
      .map((phone) => {
        const phoneTypeId = phone?.phone_type?.phone_type_id ?? phone?.phone_type_id ?? "";
        return {
          ...phone,
          phone: phone?.phone ?? "",
          phone_type: phone?.phone_type ?? {
            phone_type_id: phoneTypeId,
            description: "",
          },
        };
      });

    const filteredAddresses = addressRows
      .filter((address) => getAddressUserId(address) === normalizedUserId)
      .map((address) => {
        const addressTypeId = address?.address_type?.address_type_id ?? address?.address_type_id ?? "";
        return {
          ...address,
          address_type: address?.address_type ?? {
            address_type_id: addressTypeId,
            description: "",
          },
        };
      });

    setPhones(filteredPhones);
    setAddresses(filteredAddresses);
  };

  const refreshAddressesForUser = async () => {
    if (!(mode !== "add" && user?.user_id)) return;
    await loadRelatedPhonesAndAddresses(user.user_id);

    if (typeof onUserUpdated === "function") {
      const refreshedUserRes = await apiRequest(`${API_URL}${user.user_id}/`);
      const refreshedUser = await refreshedUserRes.json();
      onUserUpdated(refreshedUser);
    }
  };

  useEffect(() => {
    Promise.all([
      apiRequest(COMPANIES_URL).then(r => r.json()),
      apiRequest(USER_TYPES_URL).then(r => r.json()),
      apiRequest(PHONE_TYPES_URL).then(r => r.json()),
      apiRequest(ADDRESS_TYPES_URL).then(r => r.json()),
    ]).then(([companies, types, phoneTypes, addressTypes]) => {
      setAllCompanies(companies);
      setUserTypes(types);
      setPhoneTypes(phoneTypes);
      setAddressTypes(addressTypes);
    });
  }, []);

  useEffect(() => {
    if (!(mode !== "add" && user?.user_id)) return;

    loadRelatedPhonesAndAddresses(user.user_id).catch((error) => {
      console.error("Failed to load user phones/addresses", error);
    });
  }, [mode, user?.user_id]);

  useEffect(() => {
    const startingCompanies = Array.isArray(user?.companies) ? user.companies : [];
    setCompanies(startingCompanies);
    setInitialCompanyIds(
      Array.from(new Set(startingCompanies.map(getCompanyId).filter((id) => id > 0)))
    );
  }, [mode, user?.user_id, user?.companies]);

  // -------------------------
  // Handlers for nested data
  // -------------------------
  const openAddCompanyModal = () => {
    setNewCompanyId("");
    setCompanyModalError("");
    setShowCompanyModal(true);
  };

  const closeCompanyModal = () => {
    setShowCompanyModal(false);
    setNewCompanyId("");
    setCompanyModalError("");
  };

  const handleSaveCompanyFromModal = () => {
    const normalizedCompanyId = Number(newCompanyId);
    if (!Number.isFinite(normalizedCompanyId) || normalizedCompanyId <= 0) {
      setCompanyModalError("Company is required.");
      return;
    }

    const alreadyLinked = companies.some(
      (company) => getCompanyId(company) === normalizedCompanyId
    );
    if (alreadyLinked) {
      closeCompanyModal();
      return;
    }

    const selectedCompany = allCompanies.find(
      (company) => Number(company.company_id) === normalizedCompanyId
    );

    if (!selectedCompany) {
      setCompanyModalError("Selected company was not found.");
      return;
    }

    setCompanies((prev) => [...prev, selectedCompany]);
    closeCompanyModal();
  };


  const removeCompany = (companyKey) => {
    setCompanies(companies.filter((company) => getCompanyRowKey(company) !== companyKey));
  };

  const openAddPhoneModal = () => {
    setEditingPhoneKey(null);
    setNewPhoneData({ phone: "", phone_type_id: "" });
    setSaveError("");
    setShowPhoneModal(true);
  };

  const openEditPhoneModal = (phone) => {
    setEditingPhoneKey(getPhoneRowKey(phone));
    setNewPhoneData({
      phone: phone?.phone || "",
      phone_type_id: String(phone?.phone_type?.phone_type_id ?? phone?.phone_type_id ?? ""),
    });
    setSaveError("");
    setShowPhoneModal(true);
  };

  const handleSavePhoneFromModal = async () => {
    const phoneDigits = normalizePhoneDigits(newPhoneData.phone);
    const phoneTypeId = Number(newPhoneData.phone_type_id);

    if (!phoneDigits || Number.isNaN(phoneTypeId) || phoneTypeId <= 0) {
      setSaveError("Phone number and Phone Type are required.");
      return;
    }

    const selectedPhoneType = phoneTypes.find(
      (type) => Number(type.phone_type_id) === phoneTypeId
    );

    const normalizedPhone = {
      phone: phoneDigits,
      phone_type: selectedPhoneType || {
        phone_type_id: phoneTypeId,
        description: "",
      },
      _isNew: true,
    };

    const isExistingUser = mode === "edit" && Boolean(user?.user_id);

    try {
      if (isExistingUser) {
        if (editingPhoneKey !== null) {
          const targetPhone = phones.find((phone) => getPhoneRowKey(phone) === editingPhoneKey);
          const persistedPhoneId = getPersistedPhoneId(targetPhone);

          if (!persistedPhoneId) {
            throw new Error("Phone ID is missing for update.");
          }

          let updatePhoneRes = await apiRequest(
            `${USER_PHONES_URL}${persistedPhoneId}/`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                phone: phoneDigits,
                phone_type_id: phoneTypeId,
                web_user: user.user_id,
              }),
            }
          );

          if (!updatePhoneRes.ok && updatePhoneRes.status === 405) {
            updatePhoneRes = await apiRequest(
              `${USER_PHONES_URL}${persistedPhoneId}/`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  phone: phoneDigits,
                  phone_type_id: phoneTypeId,
                  web_user: user.user_id,
                }),
              }
            );
          }

          if (!updatePhoneRes.ok) {
            const errorMessage = await getResponseErrorMessage(updatePhoneRes);
            throw new Error(`Phone update failed: ${errorMessage}`);
          }

          await refreshAddressesForUser();
        } else {
          const createPhoneRes = await apiRequest(USER_PHONES_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: phoneDigits,
              phone_type_id: phoneTypeId,
              web_user: user.user_id,
            }),
          });

          if (!createPhoneRes.ok) {
            const errorMessage = await getResponseErrorMessage(createPhoneRes);
            throw new Error(`Phone create failed: ${errorMessage}`);
          }

          await refreshAddressesForUser();
        }
      } else if (editingPhoneKey !== null) {
        setPhones((prev) =>
          prev.map((phone) =>
            getPhoneRowKey(phone) === editingPhoneKey
              ? { ...phone, ...normalizedPhone }
              : phone
          )
        );
      } else {
        setPhones((prev) => [
          ...prev,
          {
            id: Date.now(),
            ...normalizedPhone,
          },
        ]);
      }

      setShowPhoneModal(false);
      setEditingPhoneKey(null);
      setSaveError("");
    } catch (err) {
      setSaveError(err?.message || "Failed to save phone");
    }
  };

  const handleRequestDeletePhone = (phoneKey) => {
    setDeletingPhoneKey(phoneKey);
    setIsDeletePhoneOpen(true);
  };

  const handleConfirmDeletePhone = async () => {
    if (deletingPhoneKey === null) return;

    const targetPhone = phones.find((phone) => getPhoneRowKey(phone) === deletingPhoneKey);
    const persistedPhoneId = getPersistedPhoneId(targetPhone);
    const isExistingUser = mode === "edit" && Boolean(user?.user_id);

    if (isExistingUser && persistedPhoneId) {
      try {
        const deletePhoneRes = await apiRequest(`${USER_PHONES_URL}${persistedPhoneId}/`, {
          method: "DELETE",
        });

        if (!deletePhoneRes.ok && deletePhoneRes.status !== 204) {
          const errorMessage = await getResponseErrorMessage(deletePhoneRes);
          throw new Error(`Phone delete failed: ${errorMessage}`);
        }
      } catch (err) {
        setSaveError(err?.message || "Failed to delete phone");
        setDeletingPhoneKey(null);
        setIsDeletePhoneOpen(false);
        return;
      }
    }

    if (isExistingUser) {
      try {
        await refreshAddressesForUser();
      } catch {
        setPhones((prev) => prev.filter((phone) => getPhoneRowKey(phone) !== deletingPhoneKey));
      }
    } else {
      setPhones((prev) => prev.filter((phone) => getPhoneRowKey(phone) !== deletingPhoneKey));
    }

    setDeletingPhoneKey(null);
    setIsDeletePhoneOpen(false);
  };

  const openAddAddressModal = () => {
    setEditingAddressKey(null);
    setNewAddressData({
      street_1: "",
      street_2: "",
      city: "",
      st: "",
      zip: "",
      country: "United States",
      address_type_id: "",
    });
    setShowAddressModal(true);
  };

  const openEditAddressModal = (address) => {
    setEditingAddressKey(getAddressRowKey(address));
    setNewAddressData({
      street_1: address?.street_1 || "",
      street_2: address?.street_2 || "",
      city: address?.city || "",
      st: address?.st || "",
      zip: address?.zip || "",
      country: address?.country || "United States",
      address_type_id: String(
        address?.address_type?.address_type_id ??
        address?.address_type_id ??
        ""
      ),
    });
    setShowAddressModal(true);
  };

  const handleSaveAddressFromModal = async () => {
    const addressTypeId = Number(newAddressData.address_type_id);
    if (!newAddressData.street_1.trim() || Number.isNaN(addressTypeId) || addressTypeId <= 0) {
      setSaveError("Address line 1 and Address Type are required.");
      return;
    }

    const selectedAddressType = addressTypes.find(
      (type) => Number(type.address_type_id) === addressTypeId
    );

    const normalizedAddress = {
      street_1: newAddressData.street_1.trim(),
      street_2: newAddressData.street_2.trim(),
      city: newAddressData.city.trim(),
      st: newAddressData.st.trim(),
      zip: newAddressData.zip.trim(),
      country: newAddressData.country.trim(),
      address_type: selectedAddressType || {
        address_type_id: addressTypeId,
        description: "",
      },
    };

    const isExistingUser = mode === "edit" && Boolean(user?.user_id);

    try {
      if (isExistingUser) {
        if (editingAddressKey !== null) {
          const targetAddress = addresses.find(
            (address) => getAddressRowKey(address) === editingAddressKey
          );
          const persistedAddressId = getPersistedAddressId(targetAddress);

          if (!persistedAddressId) {
            throw new Error("Address ID is missing for update.");
          }

          let updateAddressRes = await apiRequest(
            `${USER_ADDRESSES_URL}${persistedAddressId}/`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...normalizedAddress,
                address_type_id: addressTypeId,
                web_user: user.user_id,
              }),
            }
          );

          if (!updateAddressRes.ok && updateAddressRes.status === 405) {
            updateAddressRes = await apiRequest(
              `${USER_ADDRESSES_URL}${persistedAddressId}/`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...normalizedAddress,
                  address_type_id: addressTypeId,
                  web_user: user.user_id,
                }),
              }
            );
          }

          if (!updateAddressRes.ok) {
            const errorMessage = await getResponseErrorMessage(updateAddressRes);
            throw new Error(`Address update failed: ${errorMessage}`);
          }

          await refreshAddressesForUser();
        } else {
          const createAddressRes = await apiRequest(USER_ADDRESSES_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...normalizedAddress,
              address_type_id: addressTypeId,
              web_user: user.user_id,
            }),
          });

          if (!createAddressRes.ok) {
            const errorMessage = await getResponseErrorMessage(createAddressRes);
            throw new Error(`Address create failed: ${errorMessage}`);
          }

          await refreshAddressesForUser();
        }
      } else {
        if (editingAddressKey !== null) {
          setAddresses((prev) =>
            prev.map((address) =>
              getAddressRowKey(address) === editingAddressKey
                ? { ...address, ...normalizedAddress, _isNew: true }
                : address
            )
          );
        } else {
          setAddresses((prev) => [
            ...prev,
            {
              id: Date.now(),
              ...normalizedAddress,
              _isNew: true,
            },
          ]);
        }
      }

      setShowAddressModal(false);
      setEditingAddressKey(null);
      setSaveError("");
    } catch (err) {
      setSaveError(err?.message || "Failed to save address");
    }
  };

  const handleRequestDeleteAddress = (addressKey) => {
    setDeletingAddressKey(addressKey);
    setIsDeleteAddressOpen(true);
  };

  const handleConfirmDeleteAddress = async () => {
    if (deletingAddressKey === null) return;

    const targetAddress = addresses.find(
      (address) => getAddressRowKey(address) === deletingAddressKey
    );
    const persistedAddressId = getPersistedAddressId(targetAddress);

    const isExistingUser = mode === "edit" && Boolean(user?.user_id);

    if (isExistingUser && persistedAddressId) {
      try {
        const deleteAddressRes = await apiRequest(
          `${USER_ADDRESSES_URL}${persistedAddressId}/`,
          { method: "DELETE" }
        );

        if (!deleteAddressRes.ok && deleteAddressRes.status !== 204) {
          const errorMessage = await getResponseErrorMessage(deleteAddressRes);
          throw new Error(`Address delete failed: ${errorMessage}`);
        }
      } catch (err) {
        setSaveError(err?.message || "Failed to delete address");
        setDeletingAddressKey(null);
        setIsDeleteAddressOpen(false);
        return;
      }
    }

    if (isExistingUser) {
      try {
        await refreshAddressesForUser();
      } catch {
        setAddresses((prev) =>
          prev.filter((address) => getAddressRowKey(address) !== deletingAddressKey)
        );
      }
    } else {
      setAddresses((prev) =>
        prev.filter((address) => getAddressRowKey(address) !== deletingAddressKey)
      );
    }

    setDeletingAddressKey(null);
    setIsDeleteAddressOpen(false);
  };

  const getSelectedUserTypeLabel = () => {
    const matchedType = userTypes.find(
      (type) => Number(type.user_type_id) === Number(userTypeId)
    );

    return formatUserTypeLabel(
      matchedType?.description || user?.user_type?.description || "\u2014"
    );
  };

  const openUserTypeModal = () => {
    setDraftUserTypeId(String(userTypeId ?? ""));
    setUserTypeModalError("");
    setShowUserTypeModal(true);
  };

  const closeUserTypeModal = () => {
    setShowUserTypeModal(false);
    setDraftUserTypeId("");
    setUserTypeModalError("");
  };

  const handleSaveUserTypeFromModal = () => {
    const normalizedDraftUserTypeId = Number(draftUserTypeId);
    if (!Number.isFinite(normalizedDraftUserTypeId) || normalizedDraftUserTypeId <= 0) {
      setUserTypeModalError("User Type is required.");
      return;
    }

    if (Number(userTypeId) === normalizedDraftUserTypeId) {
      closeUserTypeModal();
      return;
    }

    setUserTypeId(String(normalizedDraftUserTypeId));
    closeUserTypeModal();
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");

    try {
        const normalizedUserTypeId = Number(userTypeId);
        if (!Number.isFinite(normalizedUserTypeId) || normalizedUserTypeId <= 0) {
          throw new Error("User Type is required.");
        }

        // 1️⃣ Save user
        const url = mode === "add" ? API_URL : `${API_URL}${user.user_id}/`;
        const method = mode === "add" ? "POST" : "PATCH";

        const userBody = {
        first_name: firstName,
        last_name: lastName,
        username,
        email,
        is_active: isActive,
        user_type_id: normalizedUserTypeId,
        ...(mode === "add" ? { password: initialPassword } : {})
        };

        let res = await apiRequest(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userBody)
        });

        if (!res.ok) {
          let userSaveErrorData = null;
          try {
            userSaveErrorData = await res.json();
          } catch {
            userSaveErrorData = null;
          }

          const expectsUserTypeField =
            Boolean(userSaveErrorData) &&
            typeof userSaveErrorData === "object" &&
            Object.prototype.hasOwnProperty.call(userSaveErrorData, "user_type");

          if (expectsUserTypeField) {
            const fallbackBody = {
              first_name: firstName,
              last_name: lastName,
              username,
              email,
              is_active: isActive,
              user_type: normalizedUserTypeId,
              ...(mode === "add" ? { password: initialPassword } : {}),
            };

            res = await apiRequest(url, {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(fallbackBody),
            });
          }

          if (!res.ok) {
            const errorMessage = await getResponseErrorMessage(res);
            throw new Error(`User save failed: ${errorMessage}`);
          }
        }

        const savedUser = await res.json();
        const userId = Number(savedUser?.user_id ?? user?.user_id ?? 0);
        if (!Number.isFinite(userId) || userId <= 0) {
          throw new Error("User save failed: missing user id from response.");
        }

        // 2️⃣ POST NEW phones
        const newPhones = phones.filter(p => p._isNew);
        await Promise.all(
        newPhones.map(async (p) => {
          const phoneDigits = normalizePhoneDigits(p.phone);
          const phoneTypeId = Number(p?.phone_type?.phone_type_id);

          if (!phoneDigits || Number.isNaN(phoneTypeId) || phoneTypeId <= 0) {
            throw new Error("Each new phone requires a phone number and phone type.");
          }

          const phoneRes = await apiRequest(USER_PHONES_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: phoneDigits,
              phone_type_id: phoneTypeId,
              web_user: userId,
            }),
          });

          if (!phoneRes.ok) {
            const errorMessage = await getResponseErrorMessage(phoneRes);
            throw new Error(`Phone save failed: ${errorMessage}`);
          }
        })
        );

        if (mode === "add") {
          const newAddresses = addresses.filter((address) => address._isNew);
          const createAddressRequests = newAddresses.map(async (address) => {
            const addressTypeId = Number(address?.address_type?.address_type_id);
            if (Number.isNaN(addressTypeId) || addressTypeId <= 0) {
              throw new Error("Address Type is required for each new address.");
            }

            const createAddressRes = await apiRequest(USER_ADDRESSES_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                street_1: address.street_1,
                street_2: address.street_2,
                city: address.city,
                st: address.st,
                zip: address.zip,
                country: address.country,
                address_type_id: addressTypeId,
                web_user: userId,
              }),
            });

            if (!createAddressRes.ok) {
              const errorMessage = await getResponseErrorMessage(createAddressRes);
              throw new Error(`Address create failed: ${errorMessage}`);
            }
          });

          await Promise.all(createAddressRequests);
        }

        // 4️⃣ Save company link changes (additions/removals)
        const currentCompanyIds = Array.from(
          new Set(companies.map(getCompanyId).filter((id) => id > 0))
        );
        const previousCompanyIds = Array.from(new Set(initialCompanyIds));

        const companyIdsToAdd = currentCompanyIds.filter(
          (companyId) => !previousCompanyIds.includes(companyId)
        );
        const companyIdsToRemove = previousCompanyIds.filter(
          (companyId) => !currentCompanyIds.includes(companyId)
        );

        await Promise.all(
          companyIdsToAdd.map(async (companyId) => {
            const createCompanyLinkRes = await apiRequest(COMPANY_USERS_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                company_id: companyId,
                user_id: userId,
              }),
            });

            if (!createCompanyLinkRes.ok) {
              const errorMessage = await getResponseErrorMessage(createCompanyLinkRes);
              throw new Error(`Company link create failed: ${errorMessage}`);
            }
          })
        );

        if (companyIdsToRemove.length > 0) {
          const companyUsersRes = await apiRequest(COMPANY_USERS_URL);
          if (!companyUsersRes.ok) {
            const errorMessage = await getResponseErrorMessage(companyUsersRes);
            throw new Error(`Company link lookup failed: ${errorMessage}`);
          }

          const companyUsersPayload = await companyUsersRes.json();
          const companyUsers = Array.isArray(companyUsersPayload)
            ? companyUsersPayload
            : Array.isArray(companyUsersPayload?.results)
              ? companyUsersPayload.results
              : [];

          const linksToDelete = companyUsers.filter(
            (companyUser) =>
              getCompanyUserUserId(companyUser) === userId &&
              companyIdsToRemove.includes(getCompanyUserCompanyId(companyUser))
          );

          await Promise.all(
            linksToDelete.map(async (companyUser) => {
              const companyUserId = getCompanyUserLinkId(companyUser);
              if (!companyUserId) return;

              const deleteCompanyLinkRes = await apiRequest(
                `${COMPANY_USERS_URL}${companyUserId}/`,
                { method: "DELETE" }
              );

              if (!deleteCompanyLinkRes.ok && deleteCompanyLinkRes.status !== 204) {
                const errorMessage = await getResponseErrorMessage(deleteCompanyLinkRes);
                throw new Error(`Company link delete failed: ${errorMessage}`);
              }
            })
          );
        }

        // 5️⃣ Return updated user to UI
        const refreshedUserRes = await apiRequest(`${API_URL}${userId}/`);
        const refreshedUser = await refreshedUserRes.json();

        if (typeof onUserUpdated === "function") {
          onUserUpdated(refreshedUser);
        }

        onSaved(refreshedUser);

    } catch (err) {
        console.error("Save failed", err);
      setSaveError(err?.message || "Save failed");
    } finally {
        setSaving(false);
    }
    };

  const companyCardTitle = companies.length === 1 ? "Company" : "Companies";
  const associatedCompanyIds = new Set(
    companies.map(getCompanyId).filter((companyId) => companyId > 0)
  );
  const availableCompaniesToAdd = allCompanies.filter(
    (company) => !associatedCompanyIds.has(Number(company.company_id))
  );


  return (
    <div className="modal-overlay">
      <div className="modal modern user-modal user-profile-modal">
        <div className="modal-header">
          <h3>{mode === "add" ? "Add User" : isEdit ? "EDIT USER" : "USER DETAILS"}</h3>
          <button className="icon-close" onClick={onClose}>✕</button>
        </div>

        <div className="user-profile-layout">
          <div className="user-profile-left">
            <div className="user-profile-identity-card">
              <div className="user-profile-avatar">
                {`${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || (username?.[0] ?? "U").toUpperCase()}
              </div>
              <div className="user-profile-name">
                {`${firstName || ""} ${lastName || ""}`.trim() || username || "New User"}
              </div>

              <div className="user-profile-meta">
                <div className="user-profile-meta-row">
                  <span className="user-profile-meta-label">Last Login</span>
                  <span className="user-profile-meta-value user-profile-meta-value-indented">{lastLogin ? new Date(lastLogin).toLocaleString() : "Never"}</span>
                </div>
                <div className="user-profile-meta-row">
                  <span className="user-profile-meta-label">User Type</span>
                  <span className={`user-profile-meta-value ${mode === "view" ? "user-profile-meta-value-indented" : ""}`}>
                    {mode === "edit" ? (
                      <span className="user-type-edit-inline">
                        <span>{getSelectedUserTypeLabel()}</span>
                        <button
                          type="button"
                          className="user-type-edit-button"
                          aria-label="Edit user type"
                          onClick={openUserTypeModal}
                        >
                          <FaEdit />
                        </button>
                      </span>
                    ) : mode === "add" ? (
                      <select value={userTypeId} onChange={e => setUserTypeId(e.target.value)}>
                        <option value="">Select type</option>
                        {userTypes.map(t => (
                          <option key={t.user_type_id} value={t.user_type_id}>
                            {formatUserTypeLabel(t.description)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      getSelectedUserTypeLabel()
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="user-profile-fields-card">
              <div className="user-profile-field-row">
                <span className="user-profile-field-label">First Name</span>
                <div className="user-profile-field-value">{isEdit ? <input value={firstName} onChange={e=>setFirstName(e.target.value)} /> : (firstName || "—")}</div>
              </div>
              <div className="user-profile-field-row">
                <span className="user-profile-field-label">Last Name</span>
                <div className="user-profile-field-value">{isEdit ? <input value={lastName} onChange={e=>setLastName(e.target.value)} /> : (lastName || "—")}</div>
              </div>
              <div className="user-profile-field-row">
                <span className="user-profile-field-label">Username</span>
                <div className="user-profile-field-value">{isEdit ? <input value={username} onChange={e=>setUsername(e.target.value)} /> : (username || "—")}</div>
              </div>
              <div className="user-profile-field-row">
                <span className="user-profile-field-label">Email</span>
                <div className="user-profile-field-value">{isEdit ? <input value={email} onChange={e=>setEmail(e.target.value)} /> : (email || "—")}</div>
              </div>
              <div className="user-profile-field-row">
                <span className="user-profile-field-label">Active</span>
                <div className="user-profile-field-value">
                  {isEdit ? (
                    <label className="checkbox-row">
                      <input type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)} />
                      <span>{isActive ? "Active" : "Inactive"}</span>
                    </label>
                  ) : (
                    isActive ? "Active" : "Inactive"
                  )}
                </div>
              </div>

              {mode === "edit" && (
                <div className="user-profile-field-row">
                  <span className="user-profile-field-label">Password</span>
                  <div className="user-profile-field-value">
                    <button
                      type="button"
                      className="user-reset-password-btn"
                      onClick={() => {
                        console.log("Password Reset Link Sent");
                      }}
                    >
                      Reset Password
                    </button>
                  </div>
                </div>
              )}

              {mode === "add" && (
                <div className="user-profile-field-row">
                  <span className="user-profile-field-label">Initial Password</span>
                  <div className="user-profile-field-value">
                    <input
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="user-profile-right">
            <div className="user-data-card">
              <button
                type="button"
                className="user-data-card-header user-data-card-header-toggle"
                onClick={() => setIsCompaniesOpen((prev) => !prev)}
                aria-expanded={isCompaniesOpen}
              >
                <span>{companyCardTitle}</span>
                <span className="user-card-chevron">{isCompaniesOpen ? "▾" : "▸"}</span>
              </button>
              {isCompaniesOpen && (
                <div className="user-data-card-body">
                  {companies.length === 0 ? (
                    <p className="user-data-empty">No companies linked.</p>
                  ) : (
                    <div className="user-companies-list">
                      {companies.map(c => (
                        <div key={getCompanyRowKey(c) ?? `company-${c.company_name}`} className="nested-row">
                          {c.company_name}
                          {isEdit && (
                            <FaTrash
                              className="icon-button"
                              style={{ color: "#111827" }}
                              onClick={()=>removeCompany(getCompanyRowKey(c))}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {isEdit && (
                    <button className="user-address-add-btn" onClick={openAddCompanyModal}>
                      + Add Company
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="user-data-card">
              <button
                type="button"
                className="user-data-card-header user-data-card-header-toggle"
                onClick={() => setIsPhonesOpen((prev) => !prev)}
                aria-expanded={isPhonesOpen}
              >
                <span>Phones</span>
                <span className="user-card-chevron">{isPhonesOpen ? "▾" : "▸"}</span>
              </button>
              {isPhonesOpen && (
                <div className="user-data-card-body">
                  {phones.length === 0 ? (
                    <p className="user-data-empty">No phones added.</p>
                  ) : (
                    <div className="user-phones-grid">
                      {phones.map((phone) => (
                        <div key={getPhoneRowKey(phone) ?? `phone-${phone.phone ?? ""}`} className="user-phone-card">
                          <div className="user-phone-card-top">
                            <strong>{phone?.phone_type?.description || "Phone"}</strong>
                            {isEdit && (
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <FaEdit
                                  className="icon-button"
                                  style={{ color: "#2563eb" }}
                                  onClick={() => openEditPhoneModal(phone)}
                                />
                                <FaTrash
                                  className="icon-button"
                                  onClick={() => handleRequestDeletePhone(getPhoneRowKey(phone))}
                                />
                              </div>
                            )}
                          </div>
                          <div className="user-phone-card-body">
                            <p>{formatPhoneForInput(phone?.phone || "") || "—"}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {isEdit && (
                    <button className="user-address-add-btn" onClick={openAddPhoneModal}>
                      + Add Phone
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="user-data-card">
              <button
                type="button"
                className="user-data-card-header user-data-card-header-toggle"
                onClick={() => setIsAddressesOpen((prev) => !prev)}
                aria-expanded={isAddressesOpen}
              >
                <span>Addresses</span>
                <span className="user-card-chevron">{isAddressesOpen ? "▾" : "▸"}</span>
              </button>
              {isAddressesOpen && (
                <div className="user-data-card-body">
                  <div className="user-addresses-section">
                    {addresses.length === 0 ? (
                      <p className="user-addresses-empty">No addresses added.</p>
                    ) : (
                      <div className="user-addresses-grid">
                        {addresses.map((address) => (
                          <div key={getAddressRowKey(address)} className="user-address-card">
                            <div className="user-address-card-top">
                              <strong>{address?.address_type?.description || "Address"}</strong>
                              {isEdit && (
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <FaEdit
                                    className="icon-button"
                                    style={{ color: "#2563eb" }}
                                    onClick={() => openEditAddressModal(address)}
                                  />
                                  <FaTrash
                                    className="icon-button"
                                    onClick={() => handleRequestDeleteAddress(getAddressRowKey(address))}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="user-address-card-body">
                              <p>{address?.street_1 || "—"}</p>
                              {address?.street_2?.trim() && (
                                <p>{address.street_2}</p>
                              )}
                              <p>
                                {address?.city || ""}
                                {address?.city && address?.st ? ", " : ""}
                                {address?.st || ""}
                                {(address?.city || address?.st) && address?.zip ? " " : ""}
                                {address?.zip || (!(address?.city || address?.st) ? "—" : "")}
                              </p>
                              <p>{address?.country || "—"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isEdit && (
                      <button className="user-address-add-btn" onClick={openAddAddressModal}>
                        + Add Address
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          {saveError && <p style={{ color: "#dc2626", marginRight: "auto" }}>{saveError}</p>}
          <button onClick={onClose}>Close</button>
          {isEdit && <button className="primary" disabled={saving} onClick={handleSave}>{saving?"Saving...":"Save"}</button>}
        </div>
      </div>

      {showAddressModal && (
        <div className="modal-overlay" style={{ zIndex: 1300 }}>
          <div className="modal modern" style={{ width: "560px" }}>
            <div className="modal-header">
              <h3>{editingAddressKey !== null ? "Edit Address" : "Add Address"}</h3>
              <button className="icon-close" onClick={() => setShowAddressModal(false)}>✕</button>
            </div>

            <div className="details-grid">
              <Detail label="Street 1">
                <input
                  value={newAddressData.street_1}
                  onChange={(e) => setNewAddressData((prev) => ({ ...prev, street_1: e.target.value }))}
                />
              </Detail>
              <Detail label="Street 2">
                <input
                  value={newAddressData.street_2}
                  onChange={(e) => setNewAddressData((prev) => ({ ...prev, street_2: e.target.value }))}
                />
              </Detail>
              <Detail label="City">
                <input
                  value={newAddressData.city}
                  onChange={(e) => setNewAddressData((prev) => ({ ...prev, city: e.target.value }))}
                />
              </Detail>
              <Detail label="State">
                <select
                  value={newAddressData.st}
                  onChange={(e) => setNewAddressData((prev) => ({ ...prev, st: e.target.value }))}
                >
                  <option value="">Select State</option>
                  {US_STATES.map((stateOption) => (
                    <option key={stateOption.value} value={stateOption.value}>
                      {stateOption.label}
                    </option>
                  ))}
                </select>
              </Detail>
              <Detail label="Zip">
                <input
                  value={newAddressData.zip}
                  onChange={(e) => setNewAddressData((prev) => ({ ...prev, zip: e.target.value }))}
                />
              </Detail>
              <Detail label="Country">
                <select
                  value={newAddressData.country}
                  onChange={(e) => setNewAddressData((prev) => ({ ...prev, country: e.target.value }))}
                >
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </Detail>
              <Detail label="Address Type">
                <select
                  value={newAddressData.address_type_id}
                  onChange={(e) => setNewAddressData((prev) => ({ ...prev, address_type_id: e.target.value }))}
                >
                  <option value="">Select Type</option>
                  {addressTypes.map((addressType) => (
                    <option key={addressType.address_type_id} value={addressType.address_type_id}>
                      {addressType.description}
                    </option>
                  ))}
                </select>
              </Detail>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowAddressModal(false)}>Cancel</button>
              <button className="primary" onClick={handleSaveAddressFromModal}>
                {editingAddressKey !== null ? "Save Address" : "Add Address"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPhoneModal && (
        <div className="modal-overlay" style={{ zIndex: 1300 }}>
          <div className="modal modern" style={{ width: "520px" }}>
            <div className="modal-header">
              <h3>{editingPhoneKey !== null ? "Edit Phone" : "Add Phone"}</h3>
              <button className="icon-close" onClick={() => setShowPhoneModal(false)}>✕</button>
            </div>

            <div className="details-grid">
              <Detail label="Phone">
                <input
                  inputMode="numeric"
                  value={formatPhoneForInput(newPhoneData.phone)}
                  onChange={(e) =>
                    setNewPhoneData((prev) => ({
                      ...prev,
                      phone: normalizePhoneDigits(e.target.value),
                    }))
                  }
                />
              </Detail>
              <Detail label="Phone Type">
                <select
                  value={newPhoneData.phone_type_id}
                  onChange={(e) =>
                    setNewPhoneData((prev) => ({ ...prev, phone_type_id: e.target.value }))
                  }
                >
                  <option value="">Select Type</option>
                  {phoneTypes.map((phoneType) => (
                    <option key={phoneType.phone_type_id} value={phoneType.phone_type_id}>
                      {phoneType.description}
                    </option>
                  ))}
                </select>
              </Detail>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowPhoneModal(false)}>Cancel</button>
              <button className="primary" onClick={handleSavePhoneFromModal}>
                {editingPhoneKey !== null ? "Save Phone" : "Add Phone"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCompanyModal && (
        <div className="modal-overlay" style={{ zIndex: 1300 }}>
          <div className="modal modern" style={{ width: "520px" }}>
            <div className="modal-header">
              <h3>Add Company</h3>
              <button className="icon-close" onClick={closeCompanyModal}>✕</button>
            </div>

            <div className="details-grid">
              <Detail label="Company">
                <select
                  value={newCompanyId}
                  onChange={(e) => {
                    setNewCompanyId(e.target.value);
                    setCompanyModalError("");
                  }}
                >
                  <option value="">Select company</option>
                  {availableCompaniesToAdd.map((company) => (
                    <option key={company.company_id} value={company.company_id}>
                      {company.company_name}
                    </option>
                  ))}
                </select>
              </Detail>
            </div>

            <div className="modal-actions">
              {companyModalError && (
                <p style={{ color: "#dc2626", marginRight: "auto" }}>{companyModalError}</p>
              )}
              <button onClick={closeCompanyModal}>Cancel</button>
              <button className="primary" onClick={handleSaveCompanyFromModal}>Add Company</button>
            </div>
          </div>
        </div>
      )}

      {showUserTypeModal && (
        <div className="modal-overlay" style={{ zIndex: 1300 }}>
          <div className="modal modern" style={{ width: "480px" }}>
            <div className="modal-header">
              <h3>Edit User Type</h3>
              <button className="icon-close" onClick={closeUserTypeModal}>✕</button>
            </div>

            <div className="details-grid">
              <Detail label="User Type">
                <select
                  value={draftUserTypeId}
                  onChange={(e) => {
                    setDraftUserTypeId(e.target.value);
                    setUserTypeModalError("");
                  }}
                >
                  <option value="">Select type</option>
                  {userTypes.map((type) => (
                    <option key={type.user_type_id} value={type.user_type_id}>
                      {formatUserTypeLabel(type.description)}
                    </option>
                  ))}
                </select>
              </Detail>
            </div>

            <div className="modal-actions">
              {userTypeModalError && (
                <p style={{ color: "#dc2626", marginRight: "auto" }}>{userTypeModalError}</p>
              )}
              <button onClick={closeUserTypeModal}>Cancel</button>
              <button className="primary" onClick={handleSaveUserTypeFromModal}>Save User Type</button>
            </div>
          </div>
        </div>
      )}

      {isDeletePhoneOpen && (
        <div className="modal-overlay" style={{ zIndex: 1350 }}>
          <div className="modal modern" style={{ width: "460px" }}>
            <div className="modal-header">
              <h3>Delete Phone</h3>
              <button
                className="icon-close"
                onClick={() => {
                  setIsDeletePhoneOpen(false);
                  setDeletingPhoneKey(null);
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ marginBottom: "18px", color: "#444" }}>
              Are you sure you want to delete this phone?
            </p>

            <div className="modal-actions">
              <button
                onClick={() => {
                  setIsDeletePhoneOpen(false);
                  setDeletingPhoneKey(null);
                }}
              >
                Cancel
              </button>
              <button className="primary" onClick={handleConfirmDeletePhone}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteAddressOpen && (
        <div className="modal-overlay" style={{ zIndex: 1350 }}>
          <div className="modal modern" style={{ width: "460px" }}>
            <div className="modal-header">
              <h3>Delete Address</h3>
              <button
                className="icon-close"
                onClick={() => {
                  setIsDeleteAddressOpen(false);
                  setDeletingAddressKey(null);
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ marginBottom: "18px", color: "#444" }}>
              Are you sure you want to delete this address?
            </p>

            <div className="modal-actions">
              <button
                onClick={() => {
                  setIsDeleteAddressOpen(false);
                  setDeletingAddressKey(null);
                }}
              >
                Cancel
              </button>
              <button className="primary" onClick={handleConfirmDeleteAddress}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default UserModal;