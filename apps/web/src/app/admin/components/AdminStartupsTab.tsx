'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Building,
  Plus,
  RefreshCw,
  Search,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
  ExternalLink,
  Edit,
  Trash2,
  Loader2,
  X,
  Check,
  AlertCircle,
  Sparkles,
  Users,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  Calendar,
  Lock,
  MessageSquare,
  Send,
} from 'lucide-react';
import { api, resolveMediaUrl } from '../../../lib/api';
import PaginationControls from '../../../components/PaginationControls';

interface StartupsTabProps {
  listings: any[];
  commitments: any[];
  inquiries?: any[];
  users?: any[];
  listingsLoading: boolean;
  admin2FaCode?: string;
  onAdmin2FaCodeChange?: (code: string) => void;
  onRefresh: () => void;
  onFeedback: (feedback: { text: string; type: 'success' | 'error' } | null) => void;
}

const formatKeyValueLines = (obj: any): string => {
  if (!obj || typeof obj !== 'object') return '';
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
};

const parseKeyValueLines = (raw: string): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (key && val) result[key] = val;
    } else {
      result[`Highlight ${Object.keys(result).length + 1}`] = trimmed;
    }
  }
  return result;
};

export default function AdminStartupsTab({
  listings,
  commitments,
  inquiries = [],
  users = [],
  listingsLoading,
  admin2FaCode = '',
  onAdmin2FaCodeChange,
  onRefresh,
  onFeedback,
}: StartupsTabProps) {
  const [search, setSearch] = useState('');
  const [selectedListingFilterId, setSelectedListingFilterId] = useState<string>('ALL');
  const [commitmentSearch, setCommitmentSearch] = useState('');
  const [commitmentStatusFilter, setCommitmentStatusFilter] = useState<'ALL' | 'CLEARED_FUNDS' | 'ACTIVE' | 'DOCUMENT_SIGNED' | 'EXITED'>('ALL');
  const [commitmentSourceFilter, setCommitmentSourceFilter] = useState<'ALL' | 'REAL_WALLET' | 'ADMIN_EXTERNAL_VERIFIED' | 'ADMIN_DISPLAY_MOCK'>('ALL');
  const [commitmentPage, setCommitmentPage] = useState(1);
  const [commitmentPageSize, setCommitmentPageSize] = useState(50);
  const [selectedCommitment, setSelectedCommitment] = useState<any | null>(null);
  const commitmentsSectionRef = useRef<HTMLDivElement | null>(null);
  const [local2FaCode, setLocal2FaCode] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualListingId, setManualListingId] = useState('');
  const [manualUserId, setManualUserId] = useState('');
  const [manualNetAmount, setManualNetAmount] = useState('1000');
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualStatus, setManualStatus] = useState<'CLEARED_FUNDS' | 'ACTIVE'>('CLEARED_FUNDS');
  const [manualSourceType, setManualSourceType] = useState<'REAL_WALLET' | 'ADMIN_EXTERNAL_VERIFIED' | 'ADMIN_DISPLAY_MOCK'>('ADMIN_EXTERNAL_VERIFIED');
  const [manualAddToCardDisplay, setManualAddToCardDisplay] = useState(false);
  const [manualApplyFee, setManualApplyFee] = useState(true);
  const [manualNotes, setManualNotes] = useState('');
  const [creatingManual, setCreatingManual] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingInqId, setReplyingInqId] = useState<string | null>(null);
  const effective2Fa = (admin2FaCode || local2FaCode || '').trim();
  const handle2FaInput = (val: string) => {
    setLocal2FaCode(val);
    onAdmin2FaCodeChange?.(val);
  };

  // Create Startup Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newStartup, setNewStartup] = useState({
    companyName: '',
    tagline: '',
    country: 'United States',
    countryCode: 'US',
    city: 'San Francisco',
    industry: 'Fintech & Payments',
    stage: 'SEED',
    instrument: 'SAFE',
    valuation: '5000000',
    fundingTarget: '500000',
    verifiedFundsRaised: '0',
    investorCount: '0',
    minInvestment: '250',
    lockInMonths: '12',
    expectedReturnPct: '18.0',
    startDate: new Date().toISOString().slice(0, 10),
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    maturityDate: new Date(new Date().setMonth(new Date().getMonth() + 12)).toISOString().slice(0, 10),
    termsAndNotes: '',
    registrationDetails: '',
    riskFactors: '',
    pitchOverview: '',
    problemSolution: '',
    businessModel: '',
    marketOpportunity: '',
    financialHighlightsText: '',
    logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
    coverImageUrl: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&auto=format&fit=crop&q=80',
  });
  const [newStartupContact, setNewStartupContact] = useState({
    contactName: '',
    contactRole: '',
    contactEmail: '',
    contactPhone: '',
    contactWhatsApp: '',
    contactNote: '',
  });
  const [newStartupLinks, setNewStartupLinks] = useState<{
    websiteUrl: string;
    linkedinUrl: string;
    twitterUrl: string;
    githubUrl: string;
    registryVerifyUrl: string;
    pitchDeckUrl: string;
    extraLinks: { label: string; url: string }[];
  }>({
    websiteUrl: '',
    linkedinUrl: '',
    twitterUrl: '',
    githubUrl: '',
    registryVerifyUrl: '',
    pitchDeckUrl: '',
    extraLinks: [],
  });
  const [newExtraLabel, setNewExtraLabel] = useState('');
  const [newExtraUrl, setNewExtraUrl] = useState('');
  const [newStartupDocs, setNewStartupDocs] = useState<{ title: string; url: string; uploadedAt: string }[]>([]);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [docTitleInput, setDocTitleInput] = useState('');

  // Valuation, Funding Range, Performance, Lock-In & Provider Fund Tracking Modal
  const [valuationModalOpen, setValuationModalOpen] = useState(false);
  const [editModalTab, setEditModalTab] = useState<'ROUND' | 'DOCS' | 'PROVIDER'>('ROUND');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [editCountry, setEditCountry] = useState('United States');
  const [editCountryCode, setEditCountryCode] = useState('US');
  const [editCity, setEditCity] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editDueDiligenceStatus, setEditDueDiligenceStatus] = useState('VERIFIED');
  const [editPitchOverview, setEditPitchOverview] = useState('');
  const [editProblemSolution, setEditProblemSolution] = useState('');
  const [editBusinessModel, setEditBusinessModel] = useState('');
  const [editMarketOpportunity, setEditMarketOpportunity] = useState('');
  const [editFinancialHighlightsText, setEditFinancialHighlightsText] = useState('');
  const [editContact, setEditContact] = useState({
    contactName: '',
    contactRole: '',
    contactEmail: '',
    contactPhone: '',
    contactWhatsApp: '',
    contactNote: '',
  });
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [newValuation, setNewValuation] = useState('');
  const [newPerformancePct, setNewPerformancePct] = useState('0');
  const [newExpectedReturnPct, setNewExpectedReturnPct] = useState('0');
  const [newFundsRaised, setNewFundsRaised] = useState('');
  const [newFundingTarget, setNewFundingTarget] = useState('');
  const [newMinInvestment, setNewMinInvestment] = useState('');
  const [newInvestorCount, setNewInvestorCount] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newLockInMonths, setNewLockInMonths] = useState('12');
  const [newMaturityDate, setNewMaturityDate] = useState('');
  const [newStage, setNewStage] = useState('SEED');
  const [newInstrument, setNewInstrument] = useState('SAFE');
  const [newListingStatus, setNewListingStatus] = useState('PUBLISHED');
  const [newTermsAndNotes, setNewTermsAndNotes] = useState('');
  const [newDueDiligenceSummary, setNewDueDiligenceSummary] = useState('');
  const [newRegistrationDetails, setNewRegistrationDetails] = useState('');
  const [newRiskFactors, setNewRiskFactors] = useState('');
  const [editLinks, setEditLinks] = useState<{
    websiteUrl: string;
    linkedinUrl: string;
    twitterUrl: string;
    githubUrl: string;
    registryVerifyUrl: string;
    pitchDeckUrl: string;
    extraLinks: { label: string; url: string }[];
  }>({
    websiteUrl: '',
    linkedinUrl: '',
    twitterUrl: '',
    githubUrl: '',
    registryVerifyUrl: '',
    pitchDeckUrl: '',
    extraLinks: [],
  });
  const [editExtraLabel, setEditExtraLabel] = useState('');
  const [editExtraUrl, setEditExtraUrl] = useState('');
  const [editDocs, setEditDocs] = useState<{ title: string; url: string; uploadedAt: string }[]>([]);
  const [editDocTitle, setEditDocTitle] = useState('');
  const [growthNotes, setGrowthNotes] = useState('');
  // Crowdfunding Provider Tracking Fields
  const [provName, setProvName] = useState('');
  const [provInvestedAmt, setProvInvestedAmt] = useState('0');
  const [provTransferredAt, setProvTransferredAt] = useState('');
  const [provExpectedReturnAmt, setProvExpectedReturnAmt] = useState('0');
  const [provExpectedReturnDate, setProvExpectedReturnDate] = useState('');
  const [provActualReceivedAmt, setProvActualReceivedAmt] = useState('0');
  const [provReceivedAt, setProvReceivedAt] = useState('');
  const [provNotes, setProvNotes] = useState('');
  const [savingValuation, setSavingValuation] = useState(false);

  const uploadVentureAsset = async (file: File): Promise<{ url: string; originalName: string } | null> => {
    setUploadingAsset(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/uploads/venture-asset', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success && res.data?.url) {
        return { url: res.data.url, originalName: res.data.originalName || file.name };
      }
      onFeedback({ text: 'Upload failed — server did not return a URL', type: 'error' });
      return null;
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to upload file', type: 'error' });
      return null;
    } finally {
      setUploadingAsset(false);
    }
  };

  // Exit Distribution Modal
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [distributionType, setDistributionType] = useState<'EXIT_BUYOUT' | 'DIVIDEND'>('EXIT_BUYOUT');
  const [totalProceeds, setTotalProceeds] = useState('');
  const [exitMultiplier, setExitMultiplier] = useState('2.0');
  const [exitNotes, setExitNotes] = useState('');
  const [distributingExit, setDistributingExit] = useState(false);

  const handleCreateStartup = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!newStartup.companyName || !newStartup.tagline || !newStartup.pitchOverview) {
      const msg = 'Please fill out company name, tagline, and pitch overview';
      setModalError(msg);
      onFeedback({ text: msg, type: 'error' });
      return;
    }

    setCreating(true);
    try {
      const { financialHighlightsText, ...restStartup } = newStartup;
      const finHighlights = parseKeyValueLines(financialHighlightsText || '');
      const res = await api.post(
        '/admin/investments/listings',
        {
          ...restStartup,
          pitchDeckUrl: newStartupLinks.pitchDeckUrl || undefined,
          officialLinks: newStartupLinks,
          supportingDocuments: newStartupDocs,
          contactInfo: newStartupContact,
          financialHighlights: Object.keys(finHighlights).length > 0 ? finHighlights : undefined,
          admin2FaCode: effective2Fa || undefined,
        },
        { headers: effective2Fa ? { 'x-admin-2fa': effective2Fa } : {} }
      );
      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'Crowdfunding round created successfully!', type: 'success' });
        setCreateModalOpen(false);
        setModalError(null);
        setNewStartupDocs([]);
        setNewStartupContact({
          contactName: '',
          contactRole: '',
          contactEmail: '',
          contactPhone: '',
          contactWhatsApp: '',
          contactNote: '',
        });
        setNewStartupLinks({
          websiteUrl: '',
          linkedinUrl: '',
          twitterUrl: '',
          githubUrl: '',
          registryVerifyUrl: '',
          pitchDeckUrl: '',
          extraLinks: [],
        });
        onRefresh();
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Failed to create startup listing';
      setModalError(errMsg);
      onFeedback({ text: errMsg, type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const toDateInput = (d: any) => {
    if (!d) return '';
    try {
      return new Date(d).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  };

  const handleOpenValuationModal = (listing: any, initialTab: 'ROUND' | 'DOCS' | 'PROVIDER' = 'ROUND') => {
    setSelectedListing(listing);
    setModalError(null);
    setEditModalTab(initialTab);
    setEditCompanyName(listing.companyName || '');
    setEditTagline(listing.tagline || '');
    setEditCountry(listing.country || 'United States');
    setEditCountryCode(listing.countryCode || 'US');
    setEditCity(listing.city || '');
    setEditIndustry(listing.industry || '');
    setEditDueDiligenceStatus(listing.dueDiligenceStatus || 'VERIFIED');
    setEditPitchOverview(listing.pitchOverview || '');
    setEditProblemSolution(listing.problemSolution || '');
    setEditBusinessModel(listing.businessModel || '');
    setEditMarketOpportunity(listing.marketOpportunity || '');
    setEditFinancialHighlightsText(formatKeyValueLines(listing.financialHighlights));
    const rawContact = listing.contactInfo && typeof listing.contactInfo === 'object' ? listing.contactInfo : {};
    setEditContact({
      contactName: rawContact.contactName || '',
      contactRole: rawContact.contactRole || '',
      contactEmail: rawContact.contactEmail || '',
      contactPhone: rawContact.contactPhone || '',
      contactWhatsApp: rawContact.contactWhatsApp || '',
      contactNote: rawContact.contactNote || '',
    });
    setEditLogoUrl(listing.logoUrl || '');
    setNewValuation(String(listing.valuation || ''));
    setNewPerformancePct(String(listing.performancePct ?? '0'));
    setNewExpectedReturnPct(String(listing.expectedReturnPct ?? '0'));
    setNewFundsRaised(String(listing.verifiedFundsRaised ?? '0'));
    setNewFundingTarget(String(listing.fundingTarget || ''));
    setNewMinInvestment(String(listing.minInvestment ?? '250'));
    setNewInvestorCount(String(listing.investorCount ?? '0'));
    setNewStartDate(toDateInput(listing.startDate || listing.createdAt));
    setNewDeadline(toDateInput(listing.deadline));
    setNewLockInMonths(String(listing.lockInMonths ?? '12'));
    setNewMaturityDate(toDateInput(listing.maturityDate));
    setNewStage(listing.stage || 'SEED');
    setNewInstrument(listing.instrument || 'SAFE');
    setNewListingStatus(listing.status || 'PUBLISHED');
    setNewTermsAndNotes(listing.termsAndNotes || '');
    setNewDueDiligenceSummary(listing.dueDiligenceSummary || '');
    setNewRegistrationDetails(listing.registrationDetails || '');
    setNewRiskFactors(listing.riskFactors || '');
    const rawLinks =
      listing.officialLinks && typeof listing.officialLinks === 'object' ? listing.officialLinks : {};
    setEditLinks({
      websiteUrl: rawLinks.websiteUrl || '',
      linkedinUrl: rawLinks.linkedinUrl || '',
      twitterUrl: rawLinks.twitterUrl || '',
      githubUrl: rawLinks.githubUrl || '',
      registryVerifyUrl: rawLinks.registryVerifyUrl || '',
      pitchDeckUrl: rawLinks.pitchDeckUrl || listing.pitchDeckUrl || '',
      extraLinks: Array.isArray(rawLinks.extraLinks) ? rawLinks.extraLinks : [],
    });
    setEditExtraLabel('');
    setEditExtraUrl('');
    setEditDocs(Array.isArray(listing.supportingDocuments) ? listing.supportingDocuments : []);
    setEditDocTitle('');
    setGrowthNotes('');
    setProvName(listing.providerName || '');
    setProvInvestedAmt(String(listing.providerInvestedAmount ?? '0'));
    setProvTransferredAt(toDateInput(listing.providerTransferredAt));
    setProvExpectedReturnAmt(String(listing.providerExpectedReturnAmount ?? '0'));
    setProvExpectedReturnDate(toDateInput(listing.providerExpectedReturnDate));
    setProvActualReceivedAmt(String(listing.providerActualReceivedAmount ?? '0'));
    setProvReceivedAt(toDateInput(listing.providerReceivedAt));
    setProvNotes(listing.providerNotes || '');
    setValuationModalOpen(true);
  };

  const handleSaveValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!selectedListing || !newValuation || parseFloat(newValuation) <= 0) {
      const msg = 'Valid post-money valuation is required';
      setModalError(msg);
      onFeedback({ text: msg, type: 'error' });
      return;
    }
    const raisedNum = parseFloat(newFundsRaised || '0');
    const targetNum = parseFloat(newFundingTarget || '0');
    const minNum = parseFloat(newMinInvestment || '0');
    const investorsNum = parseInt(newInvestorCount || '0', 10);

    if (!Number.isFinite(raisedNum) || raisedNum < 0) {
      const msg = 'Invested / raised funds cannot be negative';
      setModalError(msg);
      onFeedback({ text: msg, type: 'error' });
      return;
    }
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      const msg = 'Funding target must be greater than zero';
      setModalError(msg);
      onFeedback({ text: msg, type: 'error' });
      return;
    }
    if (!Number.isFinite(minNum) || minNum <= 0) {
      const msg = 'Minimum investment check must be greater than zero';
      setModalError(msg);
      onFeedback({ text: msg, type: 'error' });
      return;
    }

    setSavingValuation(true);
    try {
      const parsedFinancialHighlights = parseKeyValueLines(editFinancialHighlightsText);
      const res = await api.patch(
        `/admin/investments/listings/${selectedListing.id}/valuation`,
        {
          companyName: editCompanyName,
          tagline: editTagline,
          country: editCountry,
          countryCode: editCountryCode,
          city: editCity,
          industry: editIndustry,
          dueDiligenceStatus: editDueDiligenceStatus,
          pitchOverview: editPitchOverview,
          problemSolution: editProblemSolution,
          businessModel: editBusinessModel,
          marketOpportunity: editMarketOpportunity,
          financialHighlights: parsedFinancialHighlights,
          contactInfo: editContact,
          logoUrl: editLogoUrl,
          valuation: parseFloat(newValuation),
          performancePct: newPerformancePct !== '' ? parseFloat(newPerformancePct) : undefined,
          expectedReturnPct: newExpectedReturnPct !== '' ? parseFloat(newExpectedReturnPct) : undefined,
          verifiedFundsRaised: raisedNum,
          fundingTarget: targetNum,
          minInvestment: minNum,
          investorCount: Number.isFinite(investorsNum) && investorsNum >= 0 ? investorsNum : 0,
          startDate: newStartDate || null,
          deadline: newDeadline || undefined,
          lockInMonths: parseInt(newLockInMonths || '12', 10),
          maturityDate: newMaturityDate || null,
          stage: newStage,
          instrument: newInstrument,
          status: newListingStatus,
          termsAndNotes: newTermsAndNotes,
          dueDiligenceSummary: newDueDiligenceSummary,
          registrationDetails: newRegistrationDetails,
          riskFactors: newRiskFactors,
          pitchDeckUrl: editLinks.pitchDeckUrl || null,
          officialLinks: editLinks,
          supportingDocuments: editDocs,
          growthNotes,
          providerName: provName,
          providerInvestedAmount: parseFloat(provInvestedAmt || '0') || 0,
          providerTransferredAt: provTransferredAt || null,
          providerExpectedReturnAmount: parseFloat(provExpectedReturnAmt || '0') || 0,
          providerExpectedReturnDate: provExpectedReturnDate || null,
          providerActualReceivedAmount: parseFloat(provActualReceivedAmt || '0') || 0,
          providerReceivedAt: provReceivedAt || null,
          providerNotes: provNotes,
          admin2FaCode: effective2Fa || undefined,
        },
        { headers: effective2Fa ? { 'x-admin-2fa': effective2Fa } : {} }
      );
      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'Crowdfunding round updated successfully!', type: 'success' });
        setValuationModalOpen(false);
        setModalError(null);
        onRefresh();
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Failed to update crowdfunding round';
      setModalError(errMsg);
      onFeedback({ text: errMsg, type: 'error' });
    } finally {
      setSavingValuation(false);
    }
  };

  const handleOpenExitModal = (listing: any) => {
    setSelectedListing(listing);
    setModalError(null);
    const raised = parseFloat(listing.verifiedFundsRaised || '0');
    setDistributionType('EXIT_BUYOUT');
    setExitMultiplier('2.0');
    setTotalProceeds(raised > 0 ? (raised * 2).toFixed(2) : '');
    setExitNotes(`Realized payout distribution for ${listing.companyName}`);
    setExitModalOpen(true);
  };

  const handleExecuteExit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!selectedListing) return;
    if ((!totalProceeds || parseFloat(totalProceeds) <= 0) && (!exitMultiplier || parseFloat(exitMultiplier) <= 0)) {
      const msg = 'Valid proceeds amount or multiplier required';
      setModalError(msg);
      onFeedback({ text: msg, type: 'error' });
      return;
    }

    setDistributingExit(true);
    try {
      const res = await api.post(
        `/admin/investments/listings/${selectedListing.id}/distribute-exit`,
        {
          distributionType,
          totalProceeds: totalProceeds ? parseFloat(totalProceeds) : undefined,
          totalGrossProceeds: totalProceeds ? parseFloat(totalProceeds) : undefined,
          exitMultiplier: exitMultiplier ? parseFloat(exitMultiplier) : undefined,
          notes: exitNotes,
          admin2FaCode: effective2Fa || undefined,
        },
        { headers: effective2Fa ? { 'x-admin-2fa': effective2Fa } : {} }
      );
      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'Exit proceeds distributed to investor wallets!', type: 'success' });
        setExitModalOpen(false);
        setModalError(null);
        onRefresh();
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Failed to distribute exit proceeds';
      setModalError(errMsg);
      onFeedback({ text: errMsg, type: 'error' });
    } finally {
      setDistributingExit(false);
    }
  };

  const handleDeleteListing = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to suspend startup campaign for ${name}?`)) return;
    try {
      const res = await api.delete(`/admin/investments/listings/${id}`, {
        headers: effective2Fa ? { 'x-admin-2fa': effective2Fa } : {},
      });
      if (res.data?.success) {
        onFeedback({ text: `Listing ${name} suspended`, type: 'success' });
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to suspend listing', type: 'error' });
    }
  };

  const handleSyncListingMetrics = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await api.post(
        `/admin/investments/listings/${id}/sync-metrics`,
        { admin2FaCode: effective2Fa || undefined },
        { headers: effective2Fa ? { 'x-admin-2fa': effective2Fa } : {} }
      );
      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'Listing funding & investor count synced!', type: 'success' });
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to sync metrics (enter Admin 2FA code if enabled)', type: 'error' });
    } finally {
      setSyncingId(null);
    }
  };

  const handleCreateManualCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!manualListingId || !manualUserId) {
      setModalError('Please select both a startup campaign and an investor account.');
      return;
    }
    setCreatingManual(true);
    try {
      const res = await api.post(
        '/admin/investments/commitments',
        {
          listingId: manualListingId,
          investorUserId: manualUserId,
          netAmount: parseFloat(manualNetAmount || '0'),
          investmentDate: manualDate,
          status: manualStatus,
          sourceType: manualSourceType,
          debitWallet: manualSourceType === 'REAL_WALLET',
          addToCardDisplay: manualSourceType === 'ADMIN_DISPLAY_MOCK' ? manualAddToCardDisplay : true,
          applyAllocationFee: manualSourceType === 'ADMIN_DISPLAY_MOCK' ? false : manualApplyFee,
          notes: manualNotes.trim() || undefined,
          admin2FaCode: effective2Fa || undefined,
        },
        { headers: effective2Fa ? { 'x-admin-2fa': effective2Fa } : {} }
      );
      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'Investor commitment recorded!', type: 'success' });
        setManualModalOpen(false);
        setManualNotes('');
        onRefresh();
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Failed to record investor commitment';
      setModalError(errMsg);
      onFeedback({ text: errMsg, type: 'error' });
    } finally {
      setCreatingManual(false);
    }
  };

  const handleDeleteMockCommitment = async (id: string, code: string) => {
    if (!confirm(`Remove unbacked Display/Mock entry ${code}? Real wallet transactions can never be deleted.`)) return;
    try {
      const res = await api.delete(`/admin/investments/commitments/${id}`, {
        headers: effective2Fa ? { 'x-admin-2fa': effective2Fa } : {},
      });
      if (res.data?.success) {
        onFeedback({ text: res.data.message || `Removed display/mock entry ${code}`, type: 'success' });
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({
        text: err.response?.data?.message || 'Failed to remove mock entry (enter 2FA code if enabled)',
        type: 'error',
      });
    }
  };

  const handleReplyInquiry = async (inquiryId: string) => {
    const replyText = (replyDrafts[inquiryId] || '').trim();
    if (!replyText) {
      onFeedback({ text: 'Please type a reply before sending.', type: 'error' });
      return;
    }
    setReplyingInqId(inquiryId);
    try {
      const res = await api.post(`/admin/investments/inquiries/${inquiryId}/reply`, {
        response: replyText,
        status: 'ANSWERED',
      });
      if (res.data?.success) {
        onFeedback({ text: res.data.message || 'Reply delivered to investor.', type: 'success' });
        setReplyDrafts((p) => ({ ...p, [inquiryId]: '' }));
        onRefresh();
      }
    } catch (err: any) {
      onFeedback({ text: err.response?.data?.message || 'Failed to send reply', type: 'error' });
    } finally {
      setReplyingInqId(null);
    }
  };

  const filteredListings = listings.filter((l) => {
    const q = search.toLowerCase().trim();
    return !q || l.companyName?.toLowerCase().includes(q) || l.industry?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <datalist id="startup-categories-list">
        {Array.from(
          new Set([
            ...listings.map((l) => String(l.industry || '').trim()).filter(Boolean),
            'Token',
            'AI & DeepTech',
            'Fintech & Payments',
            'CleanTech & Mobility',
            'Supply Chain & Logistics',
            'Digital Assets & Web3',
            'Clean Energy & Infrastructure',
            'AI & RegTech',
          ])
        ).map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-purple-400" />
            <span>Venture Equity &amp; Startup Crowdfunding ({listings.length})</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Create new startup rounds, review investor equity allocations, and execute realized buyout payouts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search startup or sector..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 w-52"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setModalError(null);
              if (!manualListingId && listings[0]?.id) setManualListingId(listings[0].id);
              setManualModalOpen(true);
            }}
            className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Investor Commitment</span>
          </button>

          <button
            onClick={() => {
              setModalError(null);
              setCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Startup Campaign</span>
          </button>

          <button
            onClick={onRefresh}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards: Strictly Separates Real Ledger-Backed vs Admin Display / Mock Numbers */}
      {(() => {
        const realWalletRows = commitments.filter((c) => (c.sourceType || 'REAL_WALLET') === 'REAL_WALLET');
        const externalRows = commitments.filter((c) => c.sourceType === 'ADMIN_EXTERNAL_VERIFIED');
        const mockRows = commitments.filter((c) => c.sourceType === 'ADMIN_DISPLAY_MOCK');

        const realWalletNetUsd = realWalletRows.reduce((sum, c) => sum + parseFloat(c.netInvestedAmount || '0'), 0);
        const externalNetUsd = externalRows.reduce((sum, c) => sum + parseFloat(c.netInvestedAmount || '0'), 0);
        const realAndExtTotalUsd = realWalletNetUsd + externalNetUsd;
        const distinctRealInvestors = new Set([...realWalletRows, ...externalRows].map((c) => c.investorUserId).filter(Boolean)).size;

        const mockCommitmentsUsd = mockRows.reduce((sum, c) => sum + parseFloat(c.netInvestedAmount || '0'), 0);
        const totalHeadlineRaised = listings.reduce((sum, l) => sum + parseFloat(l.verifiedFundsRaised || '0'), 0);
        const displayOffsetUsd = totalHeadlineRaised - realAndExtTotalUsd;

        const totalFeesCollected = [...realWalletRows, ...externalRows].reduce(
          (sum, c) => sum + parseFloat(c.allocationFeeAmount || '0') + parseFloat(c.profitShareFeeAmount || '0'),
          0
        );
        const publishedCnt = listings.filter((l) => l.status === 'PUBLISHED').length;
        const reviewCnt = listings.filter((l) => l.status === 'UNDER_REVIEW').length;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/35 space-y-1">
              <span className="text-[10px] text-emerald-400 uppercase font-mono font-bold">Real Ledger-Backed Raised</span>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                ${realWalletNetUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </div>
              <p className="text-[10px] text-slate-300 font-semibold">
                {realWalletRows.length} Real Wallet TX · {distinctRealInvestors} Unique Investors
              </p>
              {externalNetUsd > 0 && (
                <p className="text-[10px] text-sky-300 font-mono">
                  + ${externalNetUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} External Bank/SPV Settled ({externalRows.length})
                </p>
              )}
            </div>

            <div className={`p-4 rounded-2xl bg-slate-900 border space-y-1 ${
              Math.abs(displayOffsetUsd) > 0.01 || mockRows.length > 0
                ? 'border-amber-500/40'
                : 'border-slate-800'
            }`}>
              <span className="text-[10px] text-amber-300 uppercase font-mono font-bold">Admin Showcase / Unbacked Offsets</span>
              <div className="text-2xl font-black text-amber-300 font-mono">
                ${(displayOffsetUsd + mockCommitmentsUsd).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </div>
              <p className="text-[10px] text-slate-400">
                Card Headline: <strong className="font-mono text-white">${totalHeadlineRaised.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> · {mockRows.length} Mock Entries
              </p>
              <p className="text-[10px] text-amber-400/90 font-semibold">
                Strictly excluded from real wallet totals, vault fees &amp; exits
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-mono">Real Protocol Fees · Pipeline</span>
              <div className="text-2xl font-black text-white font-mono">
                ${totalFeesCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </div>
              <p className="text-[10px] text-slate-400">
                {publishedCnt} Published · {reviewCnt} Under Review · {inquiries.filter((q) => !q.response).length} Open Inquiries
              </p>
            </div>
          </div>
        );
      })()}

      {/* Listings Table */}
      {listingsLoading ? (
        <div className="p-16 text-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500 mb-2" />
          <p className="text-xs">Loading startup listings...</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="p-16 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-3xl">
          <Building className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-400">No startup campaigns currently listed</p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="mt-3 text-xs text-purple-400 hover:underline cursor-pointer"
          >
            Create first startup listing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredListings.map((l) => {
            const raised = parseFloat(l.verifiedFundsRaised || '0');
            const target = parseFloat(l.fundingTarget || '1');
            const pct = Math.min(100, Math.round((raised / target) * 100));
            const matchingCommitmentsCount = commitments.filter(
              (c) => (c.listing?.id || c.listingId) === l.id
            ).length;
            const isSelected = selectedListingFilterId === l.id;

            return (
              <div
                key={l.id}
                onClick={() => {
                  setSelectedListingFilterId(l.id);
                  setCommitmentPage(1);
                  commitmentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`p-5 rounded-3xl bg-slate-900 border space-y-4 transition-all shadow-lg cursor-pointer ${
                  isSelected
                    ? 'border-purple-500 ring-2 ring-purple-500/30'
                    : 'border-slate-800 hover:border-purple-500/50'
                }`}
                title="Click to inspect all customers who invested in this startup"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={resolveMediaUrl(l.logoUrl) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80'}
                      alt={l.companyName}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-800 shrink-0"
                    />
                    <div>
                      <h4 className="font-extrabold text-white text-base">{l.companyName}</h4>
                      <p className="text-xs text-slate-400">{l.tagline}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-300">
                          {l.stage} • {l.instrument}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5 text-amber-400" />
                          {l.lockInMonths ?? 12}m Lock
                        </span>
                        {Number(l.performancePct || 0) !== 0 && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              Number(l.performancePct) >= 0
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {Number(l.performancePct) >= 0 ? '+' : ''}
                            {Number(l.performancePct).toFixed(1)}% Perf
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">{l.industry}</span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    l.status === 'PUBLISHED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : l.status === 'UNDER_REVIEW'
                      ? 'bg-amber-500/20 text-amber-300'
                      : l.status === 'SUSPENDED'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {l.status}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-white">${raised.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span className="text-slate-400">${target.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div className="h-full bg-purple-500 transition-all rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Valuation, Lock-In & Reconciliation Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Valuation</span>
                    <strong className="text-white font-mono">${parseFloat(l.valuation).toLocaleString('en-US')}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Min Check</span>
                    <strong className="text-white font-mono">${parseFloat(l.minInvestment).toLocaleString('en-US')}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Investors</span>
                    <strong className="text-white font-mono">
                      {l.investorCount || 0}
                      {l.actualDistinctInvestorsCount !== undefined && l.actualDistinctInvestorsCount !== (l.investorCount || 0) && (
                        <span className="text-[10px] text-amber-300 font-normal"> ({l.actualDistinctInvestorsCount} on ledger)</span>
                      )}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Maturity / Docs</span>
                    <strong className="text-slate-200 font-mono text-[10px]">
                      {l.maturityDate ? new Date(l.maturityDate).toLocaleDateString() : `${l.lockInMonths ?? 12}m`} · {Array.isArray(l.supportingDocuments) ? l.supportingDocuments.length : 0} doc
                    </strong>
                  </div>
                </div>

                {/* Real vs Display Reconciliation Breakdown */}
                <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[10px] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-emerald-400 font-mono font-bold">
                    Real Wallet Ledger: ${Number(l.realWalletCollectedUsd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ({l.realWalletInvestorsCount ?? 0} real inv.)
                  </span>
                  {Number(l.externalVerifiedCollectedUsd || 0) > 0 && (
                    <span className="text-sky-300 font-mono">
                      External Settled: ${Number(l.externalVerifiedCollectedUsd).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {Number(l.displayMockCount || 0) > 0 && (
                    <span className="text-amber-300 font-mono">
                      Mock/Demo: ${Number(l.displayMockCollectedUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ({l.displayMockCount})
                    </span>
                  )}
                </div>

                {(Math.abs(Number(l.actualCollectedFromUsersUsd || 0) - raised) > 0.01 ||
                  (l.actualDistinctInvestorsCount !== undefined && Number(l.actualDistinctInvestorsCount) !== Number(l.investorCount || 0))) && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] flex flex-wrap items-center justify-between gap-2 text-amber-200"
                  >
                    <span>
                      ⚠️ Display Offset vs Real Ledger: <strong className="font-mono text-white">{(raised - Number(l.actualCollectedFromUsersUsd || 0)) >= 0 ? '+' : '-'}${Math.abs(raised - Number(l.actualCollectedFromUsersUsd || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>{' '}
                      (Unbacked display adjustment on card)
                    </span>
                    <button
                      type="button"
                      disabled={syncingId === l.id}
                      onClick={() => handleSyncListingMetrics(l.id)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer disabled:opacity-50"
                      title="Strip false/display offset and set card Raised ($) and Investors Count strictly from real & external verified commitments"
                    >
                      {syncingId === l.id ? 'Syncing...' : 'Reset Card to Real Ledger'}
                    </button>
                  </div>
                )}

                {(Number(l.providerInvestedAmount || 0) > 0 || Number(l.providerActualReceivedAmount || 0) > 0) && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/25 border border-emerald-500/25 text-[10px] font-mono flex flex-wrap items-center justify-between gap-2 text-slate-300">
                    <span>
                      Provider Sent: <strong className="text-white">${Number(l.providerInvestedAmount || 0).toLocaleString()}</strong>
                    </span>
                    <span>
                      Received Back: <strong className="text-emerald-400">${Number(l.providerActualReceivedAmount || 0).toLocaleString()}</strong>
                    </span>
                    <span>
                      Distributed: <strong className="text-sky-300">${Number(l.actualDistributedToUsersUsd || 0).toLocaleString()}</strong>
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div
                  className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2 flex-wrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleDeleteListing(l.id, l.companyName)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Suspend Campaign"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedListingFilterId(isSelected ? 'ALL' : l.id);
                        setCommitmentPage(1);
                        commitmentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-purple-500/15 hover:bg-purple-600 text-purple-300 hover:text-white border-purple-500/30'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Investors ({matchingCommitmentsCount})</span>
                    </button>

                    <button
                      onClick={() => handleOpenValuationModal(l, 'ROUND')}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-bold transition-all border border-amber-500/30 cursor-pointer flex items-center gap-1"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Manage &amp; Performance</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenValuationModal(l, 'PROVIDER')}
                      className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-300 hover:text-white text-xs font-bold transition-all border border-sky-500/30 cursor-pointer flex items-center gap-1"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Provider Tracking</span>
                    </button>

                    <button
                      onClick={() => handleOpenExitModal(l)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-black transition-all border border-emerald-500/30 cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Distribute Exit / Dividend</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Investor Commitments Ledger Table (Per-Startup Drill-Down, Search & Pagination) */}
      {(() => {
        const selectedStartupObj =
          selectedListingFilterId !== 'ALL'
            ? listings.find((l) => l.id === selectedListingFilterId) || null
            : null;
        const cQuery = commitmentSearch.trim().toLowerCase();
        const filteredCommitments = commitments.filter((inv) => {
          const lid = inv.listing?.id || inv.listingId;
          if (selectedListingFilterId !== 'ALL' && lid !== selectedListingFilterId) return false;
          if (commitmentStatusFilter !== 'ALL' && inv.status !== commitmentStatusFilter) return false;
          const invSrc = inv.sourceType || 'REAL_WALLET';
          if (commitmentSourceFilter !== 'ALL' && invSrc !== commitmentSourceFilter) return false;
          if (!cQuery) return true;
          const invName = `${inv.investor?.firstName || ''} ${inv.investor?.lastName || ''}`.trim().toLowerCase();
          return (
            invName.includes(cQuery) ||
            String(inv.investor?.email || '').toLowerCase().includes(cQuery) ||
            String(inv.investmentCode || '').toLowerCase().includes(cQuery) ||
            String(inv.listing?.companyName || '').toLowerCase().includes(cQuery)
          );
        });
        const totalCPages = Math.max(1, Math.ceil(filteredCommitments.length / commitmentPageSize));
        const safeCPage = Math.min(commitmentPage, totalCPages);
        const pageCommitments = filteredCommitments.slice(
          (safeCPage - 1) * commitmentPageSize,
          safeCPage * commitmentPageSize
        );

        return (
          <div ref={commitmentsSectionRef} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-extrabold text-base text-white">
                    {selectedStartupObj
                      ? `Investors in ${selectedStartupObj.companyName} (${filteredCommitments.length})`
                      : `All Investor Commitments (${filteredCommitments.length} / ${commitments.length})`}
                  </h3>
                  {selectedStartupObj && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedListingFilterId('ALL');
                        setCommitmentPage(1);
                      }}
                      className="px-2.5 py-0.5 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-[11px] font-bold border border-purple-500/40 cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Show All Startups
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Click any startup card above to inspect its exact investors, or click an investor name to open their Client View.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedListingFilterId}
                  onChange={(e) => {
                    setSelectedListingFilterId(e.target.value);
                    setCommitmentPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-semibold outline-none focus:border-purple-500"
                >
                  <option value="ALL">All Startups ({commitments.length})</option>
                  {listings.map((l) => {
                    const cnt = commitments.filter((c) => (c.listing?.id || c.listingId) === l.id).length;
                    return (
                      <option key={l.id} value={l.id}>
                        {l.companyName} ({cnt})
                      </option>
                    );
                  })}
                </select>

                <select
                  value={commitmentStatusFilter}
                  onChange={(e) => {
                    setCommitmentStatusFilter(e.target.value as any);
                    setCommitmentPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-semibold outline-none focus:border-purple-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="CLEARED_FUNDS">CLEARED_FUNDS</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DOCUMENT_SIGNED">DOCUMENT_SIGNED</option>
                  <option value="EXITED">EXITED</option>
                </select>

                <select
                  value={commitmentSourceFilter}
                  onChange={(e) => {
                    setCommitmentSourceFilter(e.target.value as any);
                    setCommitmentPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-semibold outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Origins (Real &amp; Mock)</option>
                  <option value="REAL_WALLET">Real Wallet Ledger Only</option>
                  <option value="ADMIN_EXTERNAL_VERIFIED">External Settled Only</option>
                  <option value="ADMIN_DISPLAY_MOCK">Display / Mock Only</option>
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={commitmentSearch}
                    onChange={(e) => {
                      setCommitmentSearch(e.target.value);
                      setCommitmentPage(1);
                    }}
                    placeholder="Search investor, email or INV code..."
                    className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 w-56"
                  />
                </div>
              </div>
            </div>

            {listingsLoading ? (
              <div className="p-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500" />
              </div>
            ) : filteredCommitments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                <p>
                  {selectedStartupObj
                    ? `No investors have committed capital to ${selectedStartupObj.companyName} yet.`
                    : commitments.length === 0
                    ? 'No investor commitments have been recorded yet. Investors appear here automatically when users invest on /investments, or when you click "Record Investor Commitment".'
                    : 'No investor commitments match your filter.'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="pb-3 pr-3">Code &amp; Date</th>
                        <th className="pb-3 pr-3">Origin / Ledger Proof</th>
                        <th className="pb-3 pr-3">Startup</th>
                        <th className="pb-3 pr-3">Investor (Client View)</th>
                        <th className="pb-3 pr-3">Net Capital (Gross)</th>
                        <th className="pb-3 pr-3">Current Value &amp; P/L</th>
                        <th className="pb-3 pr-3">Lock-In / Maturity</th>
                        <th className="pb-3 pr-3">Distributed</th>
                        <th className="pb-3 pr-3 text-right">Status</th>
                        <th className="pb-3 text-right">Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {pageCommitments.map((inv) => {
                        const netAmt = parseFloat(inv.netInvestedAmount || '0');
                        const grossAmt = parseFloat(inv.grossAmount || '0');
                        const curVal = parseFloat(String(inv.currentValuation ?? inv.netInvestedAmount ?? '0'));
                        const plUsd = inv.profitLossUsd !== undefined ? Number(inv.profitLossUsd) : curVal - netAmt;
                        const retPct = parseFloat(String(inv.unrealizedReturnPct ?? (netAmt > 0 ? (plUsd / netAmt) * 100 : 0)));
                        const lockMonths = Number(inv.lockInMonths ?? inv.listing?.lockInMonths ?? 12);
                        const matDate = inv.expectedMaturityDate || inv.lockInEnd || inv.listing?.maturityDate;
                        const srcType = inv.sourceType || 'REAL_WALLET';
                        return (
                        <tr
                          key={inv.id}
                          onClick={() => setSelectedCommitment(inv)}
                          className={`hover:bg-slate-800/60 transition-colors cursor-pointer group ${
                            srcType === 'ADMIN_DISPLAY_MOCK' ? 'bg-amber-950/15' : ''
                          }`}
                          title="Click to inspect full allocation, settlement, lock-in & documents"
                        >
                          <td className="py-3 pr-3 whitespace-nowrap">
                            <div className="font-mono font-bold text-amber-400 group-hover:underline">{inv.investmentCode}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {new Date(inv.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 pr-3 whitespace-nowrap">
                            {srcType === 'ADMIN_DISPLAY_MOCK' ? (
                              <div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  DISPLAY / MOCK
                                </span>
                                <div className="text-[10px] text-amber-400/80 mt-0.5">Unbacked (No Real TX)</div>
                              </div>
                            ) : srcType === 'ADMIN_EXTERNAL_VERIFIED' ? (
                              <div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/20 text-sky-300 border border-sky-500/40">
                                  EXTERNAL WIRE
                                </span>
                                <div className="text-[10px] text-slate-400 mt-0.5">No Wallet Debit</div>
                              </div>
                            ) : (
                              <div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  REAL LEDGER
                                </span>
                                <div className="text-[10px] text-emerald-400/80 font-mono mt-0.5">
                                  {inv.ledgerTxCode || 'Wallet Debited'}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-3 pr-3 font-bold text-white">{inv.listing?.companyName || '—'}</td>
                          <td className="py-3 pr-3 text-slate-300">
                            {inv.investor?.id ? (
                              <Link
                                href={`/dashboard?inspectUser=${inv.investor.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 font-bold text-white hover:text-emerald-400 transition-colors"
                                title="Open Client View for this investor"
                              >
                                <span className="hover:underline">
                                  {inv.investor?.firstName} {inv.investor?.lastName}
                                </span>
                                <ExternalLink className="w-3 h-3 text-slate-500 hover:text-emerald-400" />
                              </Link>
                            ) : (
                              <div className="font-bold">
                                {inv.investor?.firstName} {inv.investor?.lastName}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500 font-mono">{inv.investor?.email}</div>
                          </td>
                          <td className="py-3 pr-3 font-mono whitespace-nowrap">
                            <div className="font-bold text-slate-200">
                              ${netAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Gross ${grossAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                          </td>
                          <td className="py-3 pr-3 font-mono whitespace-nowrap">
                            <div className="font-black text-emerald-400">
                              ${curVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                            </div>
                            <span
                              className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                retPct >= 0
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              {plUsd >= 0 ? '+' : '-'}${Math.abs(plUsd).toFixed(2)} ({retPct >= 0 ? '+' : ''}{retPct.toFixed(1)}%)
                            </span>
                          </td>
                          <td className="py-3 pr-3 font-mono whitespace-nowrap text-[11px]">
                            <div className="text-amber-300 font-bold">{lockMonths}m Lock</div>
                            <div className="text-[10px] text-slate-400">
                              {inv.status === 'EXITED'
                                ? 'Exited'
                                : inv.isLockInEnded
                                ? 'Unlocked'
                                : `${inv.daysRemaining ?? 0}d left${matDate ? ` (${new Date(matDate).toLocaleDateString()})` : ''}`}
                            </div>
                          </td>
                          <td className="py-3 pr-3 font-mono font-bold text-white whitespace-nowrap">
                            ${parseFloat(inv.realizedProceeds || '0').toFixed(2)} USD
                          </td>
                          <td className="py-3 pr-3 text-right">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                inv.status === 'EXITED'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {srcType === 'ADMIN_DISPLAY_MOCK' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMockCommitment(inv.id, inv.investmentCode);
                                  }}
                                  className="p-1 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 cursor-pointer"
                                  title="Delete this Display/Mock entry (requires 2FA if enabled)"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCommitment(inv);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/40 text-[10px] font-bold text-slate-200 hover:text-amber-300 cursor-pointer"
                              >
                                Details →
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>

                <PaginationControls
                  currentPage={safeCPage}
                  totalItems={filteredCommitments.length}
                  pageSize={commitmentPageSize}
                  onPageChange={setCommitmentPage}
                  onPageSizeChange={(s) => { setCommitmentPageSize(s); setCommitmentPage(1); }}
                  itemLabel="investors"
                  theme="dark"
                />
              </>
            )}
          </div>
        );
      })()}

      {/* MANAGE CROWDFUNDING ROUND, PERFORMANCE (+/- %), LOCK-IN, DOCS & PROVIDER TRACKING MODAL */}
      {valuationModalOpen && selectedListing && (() => {
        const previewRaised = Math.max(0, parseFloat(newFundsRaised || '0') || 0);
        const previewTarget = Math.max(1, parseFloat(newFundingTarget || '1') || 1);
        const previewPct = Math.min(100, Math.round((previewRaised / previewTarget) * 100));
        const provSent = parseFloat(provInvestedAmt || '0') || 0;
        const provExp = parseFloat(provExpectedReturnAmt || '0') || 0;
        const provRec = parseFloat(provActualReceivedAmt || '0') || 0;
        const provPnl = provRec - provSent;
        const distToUsers = Number(selectedListing.actualDistributedToUsersUsd || 0);

        return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveValuation}
            className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 my-auto max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <img
                  src={resolveMediaUrl(editLogoUrl) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80'}
                  alt={editCompanyName}
                  className="w-10 h-10 rounded-xl object-cover border border-slate-800"
                />
                <div>
                  <h3 className="text-base font-extrabold text-white">Crowdfunding Round Management</h3>
                  <p className="text-xs text-slate-400">{selectedListing.companyName}</p>
                </div>
              </div>
              <button type="button" onClick={() => setValuationModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3-Tab Switcher */}
            <div className="grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-bold">
              {[
                { id: 'ROUND', label: 'Round, Value & Lock-In' },
                { id: 'DOCS', label: `Docs, Links & Risks (${editDocs.length})` },
                { id: 'PROVIDER', label: 'Provider Fund Tracking' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEditModalTab(t.id as any)}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
                    editModalTab === t.id
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {editModalTab === 'ROUND' && (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Live Campaign Progress Preview:</span>
                    <span className="font-mono font-bold text-purple-300">{previewPct}% Funded</span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-white font-bold">${previewRaised.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <span className="text-slate-400">/ ${previewTarget.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div className="h-full bg-purple-500 transition-all rounded-full" style={{ width: `${previewPct}%` }} />
                  </div>
                </div>

                {/* Project Logo Upload */}
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={resolveMediaUrl(editLogoUrl) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80'}
                      alt="Project Logo"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                    />
                    <div>
                      <div className="font-bold text-white">Project Logo</div>
                      <p className="text-[10px] text-slate-400">Upload PNG/JPG/WebP/SVG logo stored persistently</p>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700 cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5 text-purple-400" />
                    <span>{uploadingAsset ? 'Uploading...' : 'Upload Logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const uploaded = await uploadVentureAsset(file);
                        if (uploaded) setEditLogoUrl(uploaded.url);
                      }}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Project / Company Name</label>
                    <input
                      type="text"
                      required
                      value={editCompanyName}
                      onChange={(e) => setEditCompanyName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Tagline</label>
                    <input
                      type="text"
                      required
                      value={editTagline}
                      onChange={(e) => setEditTagline(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Industry / Category</label>
                    <input
                      type="text"
                      list="startup-categories-list"
                      value={editIndustry}
                      onChange={(e) => setEditIndustry(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Country</label>
                    <input
                      type="text"
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">City / HQ</label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">DD Status</label>
                    <select
                      value={editDueDiligenceStatus}
                      onChange={(e) => setEditDueDiligenceStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                    >
                      <option value="VERIFIED">VERIFIED</option>
                      <option value="PENDING_REVIEW">PENDING REVIEW</option>
                      <option value="FEATURED">FEATURED</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Invested / Raised ($ USD)</label>
                      <button
                        type="button"
                        onClick={() => {
                          setNewFundsRaised('0');
                          setNewInvestorCount('0');
                        }}
                        className="text-[10px] font-bold text-rose-400 hover:underline cursor-pointer"
                      >
                        Reset to $0
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={newFundsRaised}
                      onChange={(e) => setNewFundsRaised(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-sm outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Funding Target ($ USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={newFundingTarget}
                      onChange={(e) => setNewFundingTarget(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-sm outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Min Check ($ USD)</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      value={newMinInvestment}
                      onChange={(e) => setNewMinInvestment(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-sm outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Investors Count</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={newInvestorCount}
                      onChange={(e) => setNewInvestorCount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-sm outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Current Valuation ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newValuation}
                      onChange={(e) => setNewValuation(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-sm outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Performance / Profit-Loss % & Expected Return */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-emerald-300 uppercase font-mono">
                      Profit / Loss Performance (% • +/-)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 5 for +5% or -3 for -3% loss"
                      value={newPerformancePct}
                      onChange={(e) => setNewPerformancePct(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-emerald-500/40 rounded-xl text-white font-mono text-sm outline-none"
                    />
                    <p className="text-[10px] text-slate-400">
                      Automatically updates Current Holding Value &amp; P&amp;L across all investor accounts.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 uppercase font-mono">Expected Target Return (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newExpectedReturnPct}
                      onChange={(e) => setNewExpectedReturnPct(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-sm outline-none"
                    />
                    <p className="text-[10px] text-slate-400">Disclosed projected annual/round return %.</p>
                  </div>
                </div>

                {/* Lock-In Period & Dates */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Lock-In (Months)</label>
                    <input
                      type="number"
                      min="0"
                      value={newLockInMonths}
                      onChange={(e) => setNewLockInMonths(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Start Date</label>
                    <input
                      type="date"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Closing Date</label>
                    <input
                      type="date"
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-amber-300 uppercase font-mono">Maturity / Exit</label>
                    <input
                      type="date"
                      value={newMaturityDate}
                      onChange={(e) => setNewMaturityDate(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-amber-500/40 rounded-xl text-white font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Round Stage</label>
                    <select
                      value={newStage}
                      onChange={(e) => setNewStage(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                    >
                      <option value="PRE_SEED">PRE-SEED</option>
                      <option value="SEED">SEED</option>
                      <option value="SERIES_A">SERIES A</option>
                      <option value="SERIES_B">SERIES B</option>
                      <option value="GROWTH">GROWTH</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Instrument</label>
                    <select
                      value={newInstrument}
                      onChange={(e) => setNewInstrument(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                    >
                      <option value="SAFE">SAFE</option>
                      <option value="EQUITY">EQUITY</option>
                      <option value="CONVERTIBLE_NOTE">CONVERTIBLE_NOTE</option>
                      <option value="DEBT">DEBT</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Status</label>
                    <select
                      value={newListingStatus}
                      onChange={(e) => setNewListingStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                    >
                      <option value="PUBLISHED">PUBLISHED</option>
                      <option value="UNDER_REVIEW">UNDER REVIEW</option>
                      <option value="DRAFT">DRAFT</option>
                      <option value="CLOSED">CLOSED</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Performance / Audit Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Q3 audit verified +5.0% valuation uplift"
                    value={growthNotes}
                    onChange={(e) => setGrowthNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                  />
                </div>
              </div>
            )}

            {editModalTab === 'DOCS' && (
              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                    Description / Investment Thesis (500+ chars &amp; Markdown headings supported)
                  </label>
                  <textarea
                    rows={5}
                    value={editPitchOverview}
                    onChange={(e) => setEditPitchOverview(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-emerald-400 uppercase font-mono">Problem &amp; Solution</label>
                    <textarea
                      rows={3}
                      placeholder="What core problem does this company solve?"
                      value={editProblemSolution}
                      onChange={(e) => setEditProblemSolution(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-indigo-400 uppercase font-mono">Business Model &amp; Revenue</label>
                    <textarea
                      rows={3}
                      placeholder="How does the company generate revenue &amp; scale?"
                      value={editBusinessModel}
                      onChange={(e) => setEditBusinessModel(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-amber-400 uppercase font-mono">Market Opportunity</label>
                    <textarea
                      rows={3}
                      placeholder="Target TAM/SAM, traction, growth thesis..."
                      value={editMarketOpportunity}
                      onChange={(e) => setEditMarketOpportunity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                    Financial &amp; Operational Highlights (One per line, Label: Value)
                  </label>
                  <textarea
                    rows={3}
                    placeholder={'Stage: Pre-Launch / Early Growth\nRevenue Target: $1.2M ARR\nUse of Funds: Engineering, Licensing & Product'}
                    value={editFinancialHighlightsText}
                    onChange={(e) => setEditFinancialHighlightsText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-[11px] outline-none"
                  />
                </div>

                {/* Direct Contact / Reach Out Details */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-3">
                  <div>
                    <div className="font-bold text-emerald-300">Investor Contact / Reach Out Desk</div>
                    <p className="text-[10px] text-slate-400">
                      Shown to prospective investors via &quot;Contact / Reach Out&quot; on this opportunity&apos;s card and dossier.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="Contact Person / Desk (e.g. Investor Relations Team)"
                      value={editContact.contactName}
                      onChange={(e) => setEditContact((p) => ({ ...p, contactName: e.target.value }))}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Role / Title (e.g. Managing Director / Founder)"
                      value={editContact.contactRole}
                      onChange={(e) => setEditContact((p) => ({ ...p, contactRole: e.target.value }))}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                    />
                    <input
                      type="email"
                      placeholder="Direct Email (e.g. investments@company.com)"
                      value={editContact.contactEmail}
                      onChange={(e) => setEditContact((p) => ({ ...p, contactEmail: e.target.value }))}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Phone / Hotline (e.g. +1 415 555 0199)"
                      value={editContact.contactPhone}
                      onChange={(e) => setEditContact((p) => ({ ...p, contactPhone: e.target.value }))}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                    />
                    <input
                      type="text"
                      placeholder="WhatsApp / Telegram Handle or URL"
                      value={editContact.contactWhatsApp}
                      onChange={(e) => setEditContact((p) => ({ ...p, contactWhatsApp: e.target.value }))}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none sm:col-span-2"
                    />
                    <input
                      type="text"
                      placeholder="Response Hours / Instructions (e.g. Mon–Fri 9am–6pm EST • Data room walkthroughs available)"
                      value={editContact.contactNote}
                      onChange={(e) => setEditContact((p) => ({ ...p, contactNote: e.target.value }))}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none sm:col-span-2"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Terms, Conditions &amp; Lock-In Notes (Shown to Investors)</label>
                  <textarea
                    rows={3}
                    placeholder="Lock-in release terms, waterfall distribution schedule, fees & reporting cadence..."
                    value={newTermsAndNotes}
                    onChange={(e) => setNewTermsAndNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Due Diligence Summary</label>
                  <textarea
                    rows={2}
                    value={newDueDiligenceSummary}
                    onChange={(e) => setNewDueDiligenceSummary(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                  />
                </div>

                {/* Risk Disclosure Editor */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-rose-400 uppercase font-mono">
                    Mandatory Risk Disclosure Statement (Users Must Acknowledge Before Investing)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="State key capital-at-risk warnings, lock-in illiquidity terms, regulatory or market risks specific to this offering..."
                    value={newRiskFactors}
                    onChange={(e) => setNewRiskFactors(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-rose-500/40 rounded-xl text-white outline-none focus:border-rose-400"
                  />
                </div>

                {/* Registration & Corporate Identity Details */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-emerald-400 uppercase font-mono">
                    Company Registration &amp; Legal Verification Details
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Delaware C-Corp Reg #88-4920112 • SEC Form C / DIFC Licence #CL-4419 • HQ Registered Address..."
                    value={newRegistrationDetails}
                    onChange={(e) => setNewRegistrationDetails(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Official Website, Social Profiles & Registry Verification Links */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div>
                    <div className="font-bold text-white">Official Links, Website, Social Media &amp; Registry</div>
                    <p className="text-[10px] text-slate-400">
                      Shown in the Company Dossier popup so investors can independently research and verify this company.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="url"
                      placeholder="Official Website URL (https://...)"
                      value={editLinks.websiteUrl}
                      onChange={(e) => setEditLinks((p) => ({ ...p, websiteUrl: e.target.value }))}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                    />
                    <input
                      type="url"
                      placeholder="LinkedIn Company Page (https://linkedin.com/company/...)"
                      value={editLinks.linkedinUrl}
                      onChange={(e) => setEditLinks((p) => ({ ...p, linkedinUrl: e.target.value }))}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                    />
                    <input
                      type="url"
                      placeholder="X / Twitter Profile (https://x.com/...)"
                      value={editLinks.twitterUrl}
                      onChange={(e) => setEditLinks((p) => ({ ...p, twitterUrl: e.target.value }))}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                    />
                    <input
                      type="url"
                      placeholder="Corporate Registry / SEC / Regulatory Filing Link"
                      value={editLinks.registryVerifyUrl}
                      onChange={(e) => setEditLinks((p) => ({ ...p, registryVerifyUrl: e.target.value }))}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                    />
                    <input
                      type="url"
                      placeholder="GitHub / Product Demo URL"
                      value={editLinks.githubUrl}
                      onChange={(e) => setEditLinks((p) => ({ ...p, githubUrl: e.target.value }))}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                    />
                    <input
                      type="url"
                      placeholder="Pitch Deck / Data Room External URL"
                      value={editLinks.pitchDeckUrl}
                      onChange={(e) => setEditLinks((p) => ({ ...p, pitchDeckUrl: e.target.value }))}
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Custom Link Label (e.g. Audited Report)"
                      value={editExtraLabel}
                      onChange={(e) => setEditExtraLabel(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                    />
                    <input
                      type="url"
                      placeholder="https://..."
                      value={editExtraUrl}
                      onChange={(e) => setEditExtraUrl(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!editExtraLabel.trim() || !editExtraUrl.trim()) return;
                        setEditLinks((p) => ({
                          ...p,
                          extraLinks: [...p.extraLinks, { label: editExtraLabel.trim(), url: editExtraUrl.trim() }],
                        }));
                        setEditExtraLabel('');
                        setEditExtraUrl('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
                    >
                      + Add Link
                    </button>
                  </div>
                  {editLinks.extraLinks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {editLinks.extraLinks.map((lnk, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-emerald-300">
                          <span>{lnk.label}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditLinks((p) => ({
                                ...p,
                                extraLinks: p.extraLinks.filter((_, i) => i !== idx),
                              }))
                            }
                            className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-white">Supporting Documents (PDF / Financial Reports)</div>
                      <p className="text-[10px] text-slate-400">Available to investors in Due Diligence &amp; Client Portfolio.</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Document title (e.g. SPV Term Sheet Q4)"
                      value={editDocTitle}
                      onChange={(e) => setEditDocTitle(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                    />
                    <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingAsset ? 'Uploading...' : 'Attach File'}</span>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const uploaded = await uploadVentureAsset(file);
                          if (uploaded) {
                            setEditDocs((prev) => [
                              ...prev,
                              {
                                title: editDocTitle.trim() || uploaded.originalName,
                                url: uploaded.url,
                                uploadedAt: new Date().toISOString(),
                              },
                            ]);
                            setEditDocTitle('');
                          }
                        }}
                      />
                    </label>
                  </div>

                  {editDocs.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {editDocs.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                          <a
                            href={resolveMediaUrl(doc.url)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-emerald-400 hover:underline font-bold truncate"
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{doc.title}</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => setEditDocs((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-rose-400 hover:text-rose-300 text-[11px] font-bold cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {editModalTab === 'PROVIDER' && (
              <div className="space-y-4 text-xs">
                {/* Live Provider Reconciliation Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-slate-900 border border-sky-500/30">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Sent to Provider</span>
                    <strong className="font-mono text-sm text-white">${provSent.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Actual Received Back</span>
                    <strong className="font-mono text-sm text-emerald-400">${provRec.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Provider Profit/Loss</span>
                    <strong className={`font-mono text-sm ${provPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {provPnl >= 0 ? '+' : '-'}${Math.abs(provPnl).toLocaleString()}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Distributed to Users</span>
                    <strong className="font-mono text-sm text-sky-300">${distToUsers.toLocaleString()}</strong>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Crowdfunding Provider / SPV Partner</label>
                  <input
                    type="text"
                    placeholder="e.g. Republic Institutional SPV / SeedInvest Custody"
                    value={provName}
                    onChange={(e) => setProvName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Amount Transferred to Provider ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={provInvestedAmt}
                      onChange={(e) => setProvInvestedAmt(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Date Funds Transferred</label>
                    <input
                      type="date"
                      value={provTransferredAt}
                      onChange={(e) => setProvTransferredAt(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Expected Return Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={provExpectedReturnAmt}
                      onChange={(e) => setProvExpectedReturnAmt(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Expected Return / Maturity Date</label>
                    <input
                      type="date"
                      value={provExpectedReturnDate}
                      onChange={(e) => setProvExpectedReturnDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-emerald-300 uppercase font-mono">Actual Amount Received Back ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={provActualReceivedAmt}
                      onChange={(e) => setProvActualReceivedAmt(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-emerald-500/40 rounded-xl text-white font-mono outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-emerald-300 uppercase font-mono">Date Received Back</label>
                    <input
                      type="date"
                      value={provReceivedAt}
                      onChange={(e) => setProvReceivedAt(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-emerald-500/40 rounded-xl text-white font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Wire Reference &amp; Reconciliation Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Bank wire MT103 / on-chain settlement tx hash, SPV audit note..."
                    value={provNotes}
                    onChange={(e) => setProvNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                  />
                </div>
              </div>
            )}

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin 2FA Authorization Code</span>
                </div>
                <p className="text-[10px] text-slate-400">Required if 2FA is enabled on your Admin account</p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="6-digit 2FA code"
                value={effective2Fa}
                onChange={(e) => handle2FaInput(e.target.value)}
                className="sm:w-44 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-center tracking-widest outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setValuationModalOpen(false);
                  setModalError(null);
                }}
                className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingValuation}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingValuation && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Round Updates</span>
              </button>
            </div>
          </form>
        </div>
        );
      })()}

      {/* CREATE CROWDFUNDING ROUND MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateStartup}
            className="bg-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Create Crowdfunding Investment Round</h3>
                  <p className="text-xs text-slate-400">Configure valuation, lock-in period, logo upload &amp; supporting documents</p>
                </div>
              </div>
              <button type="button" onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Project Logo Upload */}
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={resolveMediaUrl(newStartup.logoUrl)}
                    alt="Logo preview"
                    className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                  />
                  <div>
                    <div className="font-bold text-white">Project Logo Upload</div>
                    <p className="text-[10px] text-slate-400">Shown on the crowdfunding marketplace &amp; investor cards</p>
                  </div>
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700 cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5 text-purple-400" />
                  <span>{uploadingAsset ? 'Uploading...' : 'Upload Logo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const uploaded = await uploadVentureAsset(file);
                      if (uploaded) setNewStartup((prev) => ({ ...prev, logoUrl: uploaded.url }));
                    }}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Project / Company Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nexura Financial"
                    value={newStartup.companyName}
                    onChange={(e) => setNewStartup({ ...newStartup, companyName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Industry / Category</label>
                  <input
                    type="text"
                    list="startup-categories-list"
                    placeholder="e.g. Token, Fintech & Payments, AI & DeepTech"
                    value={newStartup.industry}
                    onChange={(e) => setNewStartup({ ...newStartup, industry: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Tagline / Summary</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next-generation institutional cross-border liquidity rails"
                  value={newStartup.tagline}
                  onChange={(e) => setNewStartup({ ...newStartup, tagline: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Country</label>
                  <input
                    type="text"
                    value={newStartup.country}
                    onChange={(e) => setNewStartup({ ...newStartup, country: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">City / HQ</label>
                  <input
                    type="text"
                    value={newStartup.city}
                    onChange={(e) => setNewStartup({ ...newStartup, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Min Ticket ($)</label>
                  <input
                    type="number"
                    required
                    value={newStartup.minInvestment}
                    onChange={(e) => setNewStartup({ ...newStartup, minInvestment: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Current Valuation ($)</label>
                  <input
                    type="number"
                    required
                    value={newStartup.valuation}
                    onChange={(e) => setNewStartup({ ...newStartup, valuation: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Funding Target ($)</label>
                  <input
                    type="number"
                    required
                    value={newStartup.fundingTarget}
                    onChange={(e) => setNewStartup({ ...newStartup, fundingTarget: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-emerald-400 uppercase font-mono">Initial Raised ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newStartup.verifiedFundsRaised}
                    onChange={(e) => setNewStartup({ ...newStartup, verifiedFundsRaised: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-emerald-400 uppercase font-mono">Initial Investors</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newStartup.investorCount}
                    onChange={(e) => setNewStartup({ ...newStartup, investorCount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Lock-In (Months)</label>
                  <input
                    type="number"
                    min="0"
                    value={newStartup.lockInMonths}
                    onChange={(e) => setNewStartup({ ...newStartup, lockInMonths: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Expected Return (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newStartup.expectedReturnPct}
                    onChange={(e) => setNewStartup({ ...newStartup, expectedReturnPct: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Start Date</label>
                  <input
                    type="date"
                    value={newStartup.startDate}
                    onChange={(e) => setNewStartup({ ...newStartup, startDate: e.target.value })}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-amber-300 uppercase font-mono">Maturity / Exit Date</label>
                  <input
                    type="date"
                    value={newStartup.maturityDate}
                    onChange={(e) => setNewStartup({ ...newStartup, maturityDate: e.target.value })}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-amber-500/40 rounded-xl text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Round Stage</label>
                  <select
                    value={newStartup.stage}
                    onChange={(e) => setNewStartup({ ...newStartup, stage: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                  >
                    <option value="PRE_SEED">PRE-SEED</option>
                    <option value="SEED">SEED</option>
                    <option value="SERIES_A">SERIES A</option>
                    <option value="GROWTH">GROWTH</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Security Instrument</label>
                  <select
                    value={newStartup.instrument}
                    onChange={(e) => setNewStartup({ ...newStartup, instrument: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                  >
                    <option value="SAFE">SAFE (Post-Money Valuation Cap)</option>
                    <option value="EQUITY">Priced Preferred Equity</option>
                    <option value="CONVERTIBLE_NOTE">Convertible Note</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">
                  Description &amp; Investment Thesis (500+ chars &amp; Markdown headings supported)
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Detail the project scope, use of funds, and revenue model..."
                  value={newStartup.pitchOverview}
                  onChange={(e) => setNewStartup({ ...newStartup, pitchOverview: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-emerald-400 uppercase font-mono">Problem &amp; Solution</label>
                  <textarea
                    rows={2}
                    placeholder="Core problem & product..."
                    value={newStartup.problemSolution}
                    onChange={(e) => setNewStartup({ ...newStartup, problemSolution: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-indigo-400 uppercase font-mono">Business Model</label>
                  <textarea
                    rows={2}
                    placeholder="Revenue streams & unit economics..."
                    value={newStartup.businessModel}
                    onChange={(e) => setNewStartup({ ...newStartup, businessModel: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-amber-400 uppercase font-mono">Market Opportunity</label>
                  <textarea
                    rows={2}
                    placeholder="Market size & growth..."
                    value={newStartup.marketOpportunity}
                    onChange={(e) => setNewStartup({ ...newStartup, marketOpportunity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                  />
                </div>
              </div>

              {/* Investor Contact / Reach Out Details */}
              <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-2">
                <div className="font-bold text-emerald-300">Investor Contact / Reach Out Desk (Optional)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Contact Person / Desk"
                    value={newStartupContact.contactName}
                    onChange={(e) => setNewStartupContact((p) => ({ ...p, contactName: e.target.value }))}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Role / Title (e.g. Investor Relations)"
                    value={newStartupContact.contactRole}
                    onChange={(e) => setNewStartupContact((p) => ({ ...p, contactRole: e.target.value }))}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Direct Email (e.g. ir@company.com)"
                    value={newStartupContact.contactEmail}
                    onChange={(e) => setNewStartupContact((p) => ({ ...p, contactEmail: e.target.value }))}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Phone / WhatsApp Number"
                    value={newStartupContact.contactPhone}
                    onChange={(e) => setNewStartupContact((p) => ({ ...p, contactPhone: e.target.value }))}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Additional contact notes / office hours"
                    value={newStartupContact.contactNote}
                    onChange={(e) => setNewStartupContact((p) => ({ ...p, contactNote: e.target.value }))}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none sm:col-span-2"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Terms, Conditions &amp; Notes</label>
                <textarea
                  rows={2}
                  placeholder="Lock-in terms, exit waterfall rules, fees..."
                  value={newStartup.termsAndNotes}
                  onChange={(e) => setNewStartup({ ...newStartup, termsAndNotes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-rose-400 uppercase font-mono">
                  Mandatory Risk Disclosure Statement
                </label>
                <textarea
                  rows={2}
                  placeholder="Capital at risk, strict lock-in period illiquidity, market & regulatory risks investors must accept..."
                  value={newStartup.riskFactors}
                  onChange={(e) => setNewStartup({ ...newStartup, riskFactors: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-rose-500/40 rounded-xl text-white outline-none resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-emerald-400 uppercase font-mono">
                  Company Registration &amp; Legal Verification Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Legal entity name, Company/EIN/Registry No., Jurisdiction, Registered office..."
                  value={newStartup.registrationDetails}
                  onChange={(e) => setNewStartup({ ...newStartup, registrationDetails: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none resize-none"
                />
              </div>

              {/* Official Website, Socials & Registry Links */}
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="font-bold text-white">Official Links, Social Media &amp; Verification (Optional)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="url"
                    placeholder="Official Website (https://...)"
                    value={newStartupLinks.websiteUrl}
                    onChange={(e) => setNewStartupLinks((p) => ({ ...p, websiteUrl: e.target.value }))}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                  />
                  <input
                    type="url"
                    placeholder="LinkedIn URL (https://linkedin.com/...)"
                    value={newStartupLinks.linkedinUrl}
                    onChange={(e) => setNewStartupLinks((p) => ({ ...p, linkedinUrl: e.target.value }))}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                  />
                  <input
                    type="url"
                    placeholder="X / Twitter URL (https://x.com/...)"
                    value={newStartupLinks.twitterUrl}
                    onChange={(e) => setNewStartupLinks((p) => ({ ...p, twitterUrl: e.target.value }))}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                  />
                  <input
                    type="url"
                    placeholder="Registry / SEC Verification Link"
                    value={newStartupLinks.registryVerifyUrl}
                    onChange={(e) => setNewStartupLinks((p) => ({ ...p, registryVerifyUrl: e.target.value }))}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Additional link label"
                    value={newExtraLabel}
                    onChange={(e) => setNewExtraLabel(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                  />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={newExtraUrl}
                    onChange={(e) => setNewExtraUrl(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newExtraLabel.trim() || !newExtraUrl.trim()) return;
                      setNewStartupLinks((p) => ({
                        ...p,
                        extraLinks: [...p.extraLinks, { label: newExtraLabel.trim(), url: newExtraUrl.trim() }],
                      }));
                      setNewExtraLabel('');
                      setNewExtraUrl('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
                  >
                    + Add Link
                  </button>
                </div>
                {newStartupLinks.extraLinks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {newStartupLinks.extraLinks.map((lnk, idx) => (
                      <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-300">
                        {lnk.label}{' '}
                        <button
                          type="button"
                          onClick={() =>
                            setNewStartupLinks((p) => ({
                              ...p,
                              extraLinks: p.extraLinks.filter((_, i) => i !== idx),
                            }))
                          }
                          className="text-rose-400 ml-1 cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Supporting Document Upload */}
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="font-bold text-white">Attach Supporting Documents (Optional)</div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Document title (e.g. Offering Memo PDF)"
                    value={docTitleInput}
                    onChange={(e) => setDocTitleInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none"
                  />
                  <label className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700 cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5 text-purple-400" />
                    <span>Attach PDF/Image</span>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const uploaded = await uploadVentureAsset(file);
                        if (uploaded) {
                          setNewStartupDocs((prev) => [
                            ...prev,
                            { title: docTitleInput.trim() || uploaded.originalName, url: uploaded.url, uploadedAt: new Date().toISOString() },
                          ]);
                          setDocTitleInput('');
                        }
                      }}
                    />
                  </label>
                </div>
                {newStartupDocs.map((d, i) => (
                  <div key={i} className="text-[11px] flex justify-between text-emerald-400">
                    <span>📄 {d.title}</span>
                    <button type="button" onClick={() => setNewStartupDocs((p) => p.filter((_, idx) => idx !== i))} className="text-rose-400 cursor-pointer">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin 2FA Authorization Code</span>
                </div>
                <p className="text-[10px] text-slate-400">Required if 2FA is enabled on your Admin account</p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="6-digit 2FA code"
                value={effective2Fa}
                onChange={(e) => handle2FaInput(e.target.value)}
                className="sm:w-44 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-center tracking-widest outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCreateModalOpen(false);
                  setModalError(null);
                }}
                className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg shadow-purple-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Publish Crowdfunding Round</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REALIZED EXIT DISTRIBUTION MODAL */}
      {exitModalOpen && selectedListing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleExecuteExit}
            className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Execute Realized Buyout Exit</h3>
                  <p className="text-xs text-slate-400">{selectedListing.companyName}</p>
                </div>
              </div>
              <button type="button" onClick={() => setExitModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl text-[11px] text-emerald-200">
              <strong>Institutional Liquidity Event:</strong> This automatically distributes the exit proceeds pro-rata into each investor&apos;s available wallet balance after deducting the 5.0% nominee success carry.
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Gross Realized Proceeds ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={totalProceeds}
                  onChange={(e) => setTotalProceeds(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Quick Multiplier Presets</label>
                <div className="grid grid-cols-4 gap-2">
                  {['1.5', '2.0', '3.0', '5.0'].map((mul) => (
                    <button
                      key={mul}
                      type="button"
                      onClick={() => {
                        setExitMultiplier(mul);
                        const raised = parseFloat(selectedListing.verifiedFundsRaised || '0');
                        if (raised > 0) setTotalProceeds((raised * parseFloat(mul)).toFixed(2));
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        exitMultiplier === mul
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {mul}x Multiplier
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Distribution Audit Reference</label>
                <input
                  type="text"
                  value={exitNotes}
                  onChange={(e) => setExitNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin 2FA Authorization Code</span>
                </div>
                <p className="text-[10px] text-slate-400">Required if 2FA is enabled on your Admin account</p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="6-digit 2FA code"
                value={effective2Fa}
                onChange={(e) => handle2FaInput(e.target.value)}
                className="sm:w-44 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-center tracking-widest outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setExitModalOpen(false);
                  setModalError(null);
                }}
                className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={distributingExit}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {distributingExit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Credit Wallets Immediately</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Investor Commitment Complete Audit Detail Modal */}
      {selectedCommitment && (() => {
        const inv = selectedCommitment;
        const netInvested = parseFloat(inv.netInvestedAmount || '0');
        const grossCommitted = parseFloat(inv.grossAmount || '0');
        const feeAmt = parseFloat(inv.allocationFeeAmount || '0');
        const curVal = parseFloat(inv.currentValuation || inv.netInvestedAmount || '0');
        const plUsd = curVal - netInvested;
        const plPct = netInvested > 0 ? (plUsd / netInvested) * 100 : 0;
        const lockMonths = Number(inv.listing?.lockInMonths ?? 12);
        const computedLockEnd =
          inv.lockInEnd ||
          inv.listing?.maturityDate ||
          new Date(new Date(inv.createdAt).setMonth(new Date(inv.createdAt).getMonth() + lockMonths));
        const docs = Array.isArray(inv.listing?.supportingDocuments) ? inv.listing.supportingDocuments : [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
              <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {inv.listing?.logoUrl ? (
                    <img
                      src={resolveMediaUrl(inv.listing.logoUrl)}
                      alt={inv.listing.companyName}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Building className="w-6 h-6 text-amber-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-400">{inv.investmentCode}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        inv.status === 'EXITED'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white truncate">{inv.listing?.companyName || 'Venture Round'}</h3>
                    <p className="text-xs text-slate-400">
                      {inv.listing?.industry} • {inv.listing?.stage} • {inv.instrument}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCommitment(null)}
                  className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
                {/* 4 Top Audit KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Net Invested</span>
                    <span className="text-base font-black font-mono text-white mt-1 block">
                      ${netInvested.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Gross ${grossCommitted.toFixed(2)} − ${feeAmt.toFixed(2)} fee
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Current Value</span>
                    <span className="text-base font-black font-mono text-white mt-1 block">
                      ${curVal.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                    </span>
                    <span className="text-[10px] text-slate-500">Mark-to-market holding</span>
                  </div>
                  <div className={`p-3.5 rounded-2xl border ${
                    plUsd >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'
                  }`}>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Profit / Loss</span>
                    <span className={`text-base font-black font-mono mt-1 block ${plUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {plUsd >= 0 ? '+' : '-'}${Math.abs(plUsd).toFixed(2)} USD
                    </span>
                    <span className={`text-[10px] font-bold ${plUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}% unrealized
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Settled / Returned</span>
                    <span className="text-base font-black font-mono text-emerald-400 mt-1 block">
                      ${parseFloat(inv.realizedProceeds || '0').toFixed(2)} USD
                    </span>
                    <span className="text-[10px] text-slate-500">Total cash distributed</span>
                  </div>
                </div>

                {/* Investor & Destination Audit Grid */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Investor / Client</span>
                    <div className="font-bold text-white mt-0.5">
                      {inv.investor?.firstName} {inv.investor?.lastName}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">{inv.investor?.email}</div>
                    {inv.investor?.phone && <div className="text-[11px] text-slate-500 font-mono">{inv.investor.phone}</div>}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Venture / Crowdfunding Destination</span>
                    <div className="font-bold text-white mt-0.5">{inv.listing?.companyName}</div>
                    <div className="text-[11px] text-slate-400">
                      {inv.listing?.country || 'International'}
                      {inv.listing?.providerName ? ` • Provider: ${inv.listing.providerName}` : ''}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Investment Date</span>
                    <span className="font-mono font-bold text-slate-200">{new Date(inv.createdAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Lock-In Period &amp; Expected Maturity</span>
                    <span className="font-mono font-bold text-amber-400">
                      {lockMonths} Months Lock-In • Ends {new Date(computedLockEnd).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Settlement & Payout Ledger Breakdown */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Settlement &amp; Distribution Reconciliation
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 font-sans block">Gross Debited From Wallet:</span>
                      <span className="font-bold text-white">${grossCommitted.toFixed(2)} USD</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-sans block">Entry Fee ({Number(inv.allocationFeePct || 5)}%):</span>
                      <span className="font-bold text-amber-400">${feeAmt.toFixed(2)} USD</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-sans block">Return of Capital:</span>
                      <span className="font-bold text-white">${parseFloat(inv.returnOfCapital || '0').toFixed(2)} USD</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-sans block">Eligible Realized Profit:</span>
                      <span className="font-bold text-emerald-400">${parseFloat(inv.eligibleNetProfit || '0').toFixed(2)} USD</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-sans block">Profit-Share Fee ({Number(inv.profitShareFeePct || 5)}%):</span>
                      <span className="font-bold text-slate-300">${parseFloat(inv.profitShareFeeAmount || '0').toFixed(2)} USD</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-sans block">Net Profit Credited:</span>
                      <span className="font-bold text-emerald-400">${parseFloat(inv.netDistributedProfit || '0').toFixed(2)} USD</span>
                    </div>
                  </div>
                  {inv.settlementReference && (
                    <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800">
                      Settlement Ref: <strong className="text-white">{inv.settlementReference}</strong>
                    </div>
                  )}
                </div>

                {/* Terms, Documents & Notes */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <span className="text-[10px] font-bold uppercase text-amber-300 block">
                    Round Terms, Documents &amp; Audit Notes
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    {inv.listing?.termsAndNotes || 'Standard nominee crowdfunding terms apply.'}
                  </p>
                  {inv.notes && (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                      {inv.notes}
                    </div>
                  )}
                  {docs.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {docs.map((doc: any, idx: number) => (
                        <a
                          key={idx}
                          href={resolveMediaUrl(doc.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-500/40 text-xs font-bold text-amber-300 hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{doc.title}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-slate-800 flex items-center justify-between gap-3">
                {inv.investor?.id ? (
                  <Link
                    href={`/dashboard?inspectUser=${inv.investor.id}`}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <span>Inspect Investor Client View</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => setSelectedCommitment(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Startup Investor Inquiries Desk */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>Investor Inquiries &amp; Reach Out Requests ({inquiries.length})</span>
            </h3>
            <p className="text-xs text-slate-400">
              Questions submitted from the /investments &quot;Contact / Reach Out&quot; modal on any listing.
            </p>
          </div>
        </div>

        {inquiries.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
            No investor inquiries submitted yet.
          </div>
        ) : (
          <div className="space-y-3">
            {inquiries.map((inq) => (
              <div key={inq.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-white">{inq.subject}</span>
                    <span className="ml-2 px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 font-bold text-[10px]">
                      {inq.listing?.companyName || 'Startup'}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      inq.status === 'ANSWERED'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {inq.status}
                  </span>
                </div>
                <p className="text-slate-300">{inq.message}</p>
                <div className="text-[10px] text-slate-500 font-mono">
                  From: {inq.investor?.firstName} {inq.investor?.lastName} ({inq.investor?.email}) •{' '}
                  {new Date(inq.createdAt).toLocaleString()}
                </div>
                {inq.response && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 text-[11px]">
                    <strong className="text-emerald-400">Official Reply:</strong> {inq.response}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="text"
                    placeholder={inq.response ? 'Update reply...' : 'Write official response to investor...'}
                    value={replyDrafts[inq.id] || ''}
                    onChange={(e) => setReplyDrafts((p) => ({ ...p, [inq.id]: e.target.value }))}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={replyingInqId === inq.id}
                    onClick={() => handleReplyInquiry(inq.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-3 h-3" />
                    <span>{replyingInqId === inq.id ? 'Sending...' : 'Reply to Investor'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Record Manual / Nominee Investor Commitment Modal */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateManualCommitment}
            className="bg-slate-950 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-white">Record Verified Investor Commitment</h3>
                <p className="text-[11px] text-slate-400">
                  Assign a real commitment to a startup round and update investor count &amp; raised funding
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManualModalOpen(false);
                  setModalError(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Startup Offering</label>
                <select
                  required
                  value={manualListingId}
                  onChange={(e) => setManualListingId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                >
                  <option value="">Select startup...</option>
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.companyName} ({l.stage} • {l.instrument})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Investor Account</label>
                <select
                  required
                  value={manualUserId}
                  onChange={(e) => setManualUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-emerald-500"
                >
                  <option value="">Select registered investor...</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Net Invested ($ USD)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={manualNetAmount}
                    onChange={(e) => setManualNetAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Investment Date</label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Commitment Status</label>
                  <select
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                  >
                    <option value="CLEARED_FUNDS">CLEARED_FUNDS</option>
                    <option value="ACTIVE">ACTIVE</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Transaction Classification</label>
                  <select
                    value={manualSourceType}
                    onChange={(e) => setManualSourceType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                  >
                    <option value="REAL_WALLET">Real User Wallet Debit (Immutable Ledger TX)</option>
                    <option value="ADMIN_EXTERNAL_VERIFIED">External Bank / SPV Settled (Real, No Wallet Debit)</option>
                    <option value="ADMIN_DISPLAY_MOCK">Display / Demo Only (Fake/Unbacked — Excluded From Ledger)</option>
                  </select>
                </div>
              </div>

              {manualSourceType === 'ADMIN_DISPLAY_MOCK' ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-[11px] text-amber-200">
                  <div>
                    <strong>Isolated Display / Demo Entry:</strong> Does NOT touch real wallets, platform fee revenue, user dashboards, or exit distributions.
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualAddToCardDisplay}
                      onChange={(e) => setManualAddToCardDisplay(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span>Also add this amount to public campaign card display</span>
                  </label>
                </div>
              ) : (
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualApplyFee}
                    onChange={(e) => setManualApplyFee(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span className="text-slate-300 font-semibold">Apply configured 5% platform allocation fee</span>
                </label>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Audit Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Wire ref, offline tranche note..."
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none"
                />
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Admin 2FA Authorization Code</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Required if 2FA is enabled on your Admin account</p>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="6-digit 2FA"
                  value={effective2Fa}
                  onChange={(e) => handle2FaInput(e.target.value)}
                  className="sm:w-40 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-center tracking-widest outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setManualModalOpen(false);
                  setModalError(null);
                }}
                className="w-full py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingManual}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {creatingManual && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Record Commitment</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

