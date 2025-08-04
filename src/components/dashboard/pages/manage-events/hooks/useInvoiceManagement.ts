import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import type {
  InvoiceFormData,
  ItemizedInvoiceItem,
  InvoiceTabState,
  JsonImportData,
} from "../types/EventRequestTypes";
import { createNewInvoice } from "../utils/eventRequestUtils";

export const useInvoiceManagement = (
  initialInvoices: InvoiceFormData[] = [],
) => {
  const [invoices, setInvoices] = useState<InvoiceFormData[]>(initialInvoices);
  const [invoiceTabState, setInvoiceTabState] = useState<InvoiceTabState>({});
  const [jsonImportData, setJsonImportData] = useState<JsonImportData>({});
  const [activeInvoiceTab, setActiveInvoiceTab] = useState<string>("");

  // Initialize tab states for existing invoices
  useEffect(() => {
    if (invoices.length > 0) {
      const newTabStates: InvoiceTabState = {};
      const newJsonData: JsonImportData = {};

      invoices.forEach((invoice) => {
        if (!invoiceTabState[invoice.id]) {
          newTabStates[invoice.id] = "details";
        }
        if (!jsonImportData[invoice.id]) {
          newJsonData[invoice.id] = "";
        }
      });

      if (Object.keys(newTabStates).length > 0) {
        setInvoiceTabState((prev) => ({ ...prev, ...newTabStates }));
      }
      if (Object.keys(newJsonData).length > 0) {
        setJsonImportData((prev) => ({ ...prev, ...newJsonData }));
      }

      // Set active tab if none is selected
      if (!activeInvoiceTab && invoices.length > 0) {
        setActiveInvoiceTab(invoices[0].id);
      }
    }
  }, [invoices.length]);

  const addInvoice = () => {
    const newInvoice = createNewInvoice();
    setInvoices((prev) => [...prev, newInvoice]);

    // Initialize tab state for new invoice
    setInvoiceTabState((prev) => ({
      ...prev,
      [newInvoice.id]: "details",
    }));
    setJsonImportData((prev) => ({
      ...prev,
      [newInvoice.id]: "",
    }));

    // Set as active tab if it's the first invoice
    if (invoices.length === 0) {
      setActiveInvoiceTab(newInvoice.id);
    }
  };

  const removeInvoice = (invoiceId: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));

    // Clean up tab state for removed invoice
    setInvoiceTabState((prev) => {
      const newState = { ...prev };
      delete newState[invoiceId];
      return newState;
    });
    setJsonImportData((prev) => {
      const newState = { ...prev };
      delete newState[invoiceId];
      return newState;
    });

    // Update active tab if the removed invoice was active
    if (activeInvoiceTab === invoiceId) {
      const remainingInvoices = invoices.filter((inv) => inv.id !== invoiceId);
      setActiveInvoiceTab(
        remainingInvoices.length > 0 ? remainingInvoices[0].id : "",
      );
    }
  };

  const updateInvoice = (
    invoiceId: string,
    updates: Partial<InvoiceFormData>,
  ) => {
    console.log(`Updating invoice ${invoiceId}:`, updates);
    setInvoices((prev) =>
      prev.map((invoice) =>
        invoice.id === invoiceId ? { ...invoice, ...updates } : invoice,
      ),
    );
  };

  const addInvoiceItem = (invoiceId: string) => {
    const newItem: ItemizedInvoiceItem = {
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (invoice) {
      updateInvoice(invoiceId, {
        items: [...invoice.items, newItem],
      });
    }
  };

  const removeInvoiceItem = (invoiceId: string, itemIndex: number) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (invoice && invoice.items.length > 1) {
      updateInvoice(invoiceId, {
        items: invoice.items.filter((_, index) => index !== itemIndex),
      });
    }
  };

  const updateInvoiceItem = (
    invoiceId: string,
    itemIndex: number,
    field: keyof ItemizedInvoiceItem,
    value: string | number,
  ) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    const updatedItems = invoice.items.map((item, index) => {
      if (index === itemIndex) {
        const updatedItem = { ...item, [field]: value };
        // Auto-calculate total when quantity or unitPrice changes
        if (field === "quantity" || field === "unitPrice") {
          updatedItem.total = updatedItem.quantity * updatedItem.unitPrice;
        }
        return updatedItem;
      }
      return item;
    });

    updateInvoice(invoiceId, { items: updatedItems });
  };

  const handleJsonImport = (invoiceId: string) => {
    const jsonText = jsonImportData[invoiceId]?.trim();
    if (!jsonText) {
      toast.error("Please enter JSON data to import");
      return;
    }

    try {
      const jsonData = JSON.parse(jsonText);
      const updates: Partial<InvoiceFormData> = {};

      if (jsonData.vendor) {
        updates.vendor = jsonData.vendor;
      }

      if (jsonData.tax !== undefined) {
        updates.tax = parseFloat(jsonData.tax) || 0;
      }

      if (jsonData.tip !== undefined) {
        updates.tip = parseFloat(jsonData.tip) || 0;
      }

      if (jsonData.items && Array.isArray(jsonData.items)) {
        const validItems = jsonData.items.map((item: any) => ({
          description: item.description || "",
          quantity: parseInt(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          total:
            (parseInt(item.quantity) || 1) * (parseFloat(item.unitPrice) || 0),
        }));
        updates.items = validItems;
      }

      updateInvoice(invoiceId, updates);

      // Clear the JSON input and switch to details tab
      setJsonImportData((prev) => ({
        ...prev,
        [invoiceId]: "",
      }));
      setInvoiceTabState((prev) => ({
        ...prev,
        [invoiceId]: "details",
      }));

      toast.success("Invoice data imported successfully");
    } catch (error) {
      console.error("Error parsing JSON:", error);
      toast.error("Invalid JSON format. Please check your data and try again.");
    }
  };

  const updateJsonImportData = (invoiceId: string, data: string) => {
    setJsonImportData((prev) => ({
      ...prev,
      [invoiceId]: data,
    }));
  };

  const updateInvoiceTabState = (
    invoiceId: string,
    tab: "details" | "import",
  ) => {
    setInvoiceTabState((prev) => ({
      ...prev,
      [invoiceId]: tab,
    }));
  };

  return {
    invoices,
    setInvoices,
    invoiceTabState,
    jsonImportData,
    activeInvoiceTab,
    setActiveInvoiceTab,
    addInvoice,
    removeInvoice,
    updateInvoice,
    addInvoiceItem,
    removeInvoiceItem,
    updateInvoiceItem,
    handleJsonImport,
    updateJsonImportData,
    updateInvoiceTabState,
  };
};
