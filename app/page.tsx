"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import CreateProjectModal from '@/components/modals/CreateProjectModal';
import DeleteProjectModal from '@/components/modals/DeleteProjectModal';
import GlobalSettings from '@/components/settings/GlobalSettings';
import { useGlobalSettings } from '@/contexts/GlobalSettingsContext';
import { getDefaultModelForCli, getModelDisplayName } from '@/lib/constants/cliModels';
import Image from 'next/image';
import {
  ArrowUp,
  ChevronDown,
  Image as ImageIcon,
  Menu,
  Pencil,
  Search,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import type { Project as ProjectSummary } from '@/types/project';
import { fetchCliStatusSnapshot, createCliStatusFallback } from '@/hooks/useCLI';
import type { CLIStatus } from '@/types/cli';
import {
  ACTIVE_CLI_BRAND_COLORS,
  ACTIVE_CLI_MODEL_OPTIONS,
  ACTIVE_CLI_OPTIONS,
  ACTIVE_CLI_OPTIONS_MAP,
  DEFAULT_ACTIVE_CLI,
  normalizeModelForCli,
  sanitizeActiveCli,
  type ActiveCliId,
} from '@/lib/utils/cliOptions';
import {
  DEFAULT_QUANT_CAPABILITY_ID,
  getQuantCapability,
  type QuantCapabilityId,
} from '@/lib/quant/capabilities';

// Ensure fetch is available
const fetchAPI = globalThis.fetch || fetch;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

// Define assistant brand colors
const ASSISTANT_OPTIONS = ACTIVE_CLI_OPTIONS.map(({ id, name, icon }) => ({
  id,
  name,
  icon,
}));

const assistantBrandColors = ACTIVE_CLI_BRAND_COLORS;

const MODEL_OPTIONS_BY_ASSISTANT = ACTIVE_CLI_MODEL_OPTIONS;

const CAPABILITY_PROMPTS: Record<QuantCapabilityId, string> = {
  stock_diagnosis:
    '分析贵州茅台最近的行情、K 线、财务和公告，生成一个个股诊断看板。需要展示数据来源、更新时间、关键指标、K 线/成交量和财务摘要。',
  technical_analysis:
    '分析宁德时代最近 120 个交易日的走势，生成技术分析看板。需要包含 K 线、成交量、均线、阶段涨跌、波动率和最大回撤。',
  fundamental_analysis:
    '分析贵州茅台最近几个报告期的基本面情况，生成财务质量看板。需要展示营收、利润、利润率、ROE、现金流和公告事件摘要。',
  asset_comparison:
    '对比贵州茅台、招商银行和 510300 的最近表现，生成多标的对比看板。需要先获取可用真实数据，并说明暂未完全接入的对比维度。',
  sector_rotation:
    '分析沪深300和创业板指最近一年的趋势和相对强弱，生成行业/指数观察看板。需要包含走势、成交量、均线、波动和阶段回撤。',
  strategy_research:
    '研究一个基于 20 日均线突破和成交量确认的 A 股趋势策略，先生成策略研究看板。需要定义信号、样本、风控和待回测指标。',
  backtest_review:
    '用最近一年的 20/60 日均线突破规则回测 510300，生成回测复盘看板。需要展示净值、回撤、交易次数、胜率、交易明细、费用参数和数据限制。',
  portfolio_risk:
    '分析一个贵州茅台、招商银行、510300 的组合风险，生成组合风控看板。需要先整理持仓、数据来源、风险维度和当前可计算的数据限制。',
};

export default function HomePage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [globalSettingsTab, setGlobalSettingsTab] = useState<'general' | 'ai-assistant'>('ai-assistant');
  const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; project: ProjectSummary | null }>({ isOpen: false, project: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [prompt, setPrompt] = useState('');
  const DEFAULT_ASSISTANT: ActiveCliId = DEFAULT_ACTIVE_CLI;
  const DEFAULT_MODEL = getDefaultModelForCli(DEFAULT_ASSISTANT);
  const sanitizeAssistant = useCallback(
    (cli?: string | null) => sanitizeActiveCli(cli, DEFAULT_ASSISTANT),
    [DEFAULT_ASSISTANT]
  );
  const normalizeModelForAssistant = useCallback(
    (assistant: string, model?: string | null) => normalizeModelForCli(assistant, model, DEFAULT_ASSISTANT),
    [DEFAULT_ASSISTANT]
  );

  const normalizeProjectPayload = useCallback((project: any): ProjectSummary => {
    const preferred = sanitizeAssistant(project?.preferredCli ?? project?.preferred_cli);
    const selected = normalizeModelForAssistant(preferred, project?.selectedModel ?? project?.selected_model);

    return {
      id: project.id,
      name: project.name,
      description: project.description ?? null,
      status: project.status,
      previewUrl: project.previewUrl ?? project.preview_url ?? null,
      createdAt: project.createdAt ?? project.created_at ?? new Date().toISOString(),
      updatedAt: project.updatedAt ?? project.updated_at,
      lastActiveAt: project.lastActiveAt ?? project.last_active_at ?? null,
      lastMessageAt: project.lastMessageAt ?? project.last_message_at ?? null,
      initialPrompt: project.initialPrompt ?? project.initial_prompt ?? null,
      services: project.services,
      preferredCli: preferred as ProjectSummary['preferredCli'],
      selectedModel: selected,
      fallbackEnabled: project.fallbackEnabled ?? project.fallback_enabled ?? false,
      quantCapabilityId: getQuantCapability(project.quantCapabilityId ?? project.quant_capability_id).id,
    };
  }, [sanitizeAssistant, normalizeModelForAssistant]);
  const [selectedAssistant, setSelectedAssistant] = useState<ActiveCliId>(DEFAULT_ASSISTANT);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [selectedCapability, setSelectedCapability] = useState<QuantCapabilityId>(DEFAULT_QUANT_CAPABILITY_ID);
  const [usingGlobalDefaults, setUsingGlobalDefaults] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [cliStatus, setCLIStatus] = useState<CLIStatus>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const selectedAssistantOption = ACTIVE_CLI_OPTIONS_MAP[selectedAssistant];
  
  // 根据当前 Agent 获取可用模型
  const availableModels = MODEL_OPTIONS_BY_ASSISTANT[selectedAssistant] || [];
  
  // 同步全局设置，直到用户在当前页面手动覆盖
  const { settings: globalSettings } = useGlobalSettings();
  
  // 判断是否是刷新进入，而不是站内导航
  useEffect(() => {
    const isPageRefresh = !sessionStorage.getItem('navigationFlag');
    
    if (isPageRefresh) {
      // 刷新或首次加载时使用全局默认值
      sessionStorage.setItem('navigationFlag', 'true');
      setIsInitialLoad(true);
      setUsingGlobalDefaults(true);
    } else {
      // 站内导航时延续本轮会话的选择
      const storedAssistantRaw = sessionStorage.getItem('selectedAssistant');
      const storedModelRaw = sessionStorage.getItem('selectedModel');

      if (storedModelRaw) {
        const storedAssistant = sanitizeAssistant(storedAssistantRaw);
        const storedModel = normalizeModelForAssistant(storedAssistant, storedModelRaw);
        setSelectedAssistant(storedAssistant);
        setSelectedModel(storedModel);
        setUsingGlobalDefaults(false);
        setIsInitialLoad(false);
        return;
      }
    }
    
    // 卸载时无需主动清理，页面刷新由 beforeunload 处理
    return () => {
      // 保留站内导航标记
    };
  }, [sanitizeAssistant, normalizeModelForAssistant]);
  
  // Apply global settings when using defaults
  useEffect(() => {
    if (!usingGlobalDefaults || !isInitialLoad) return;
    
    const cli = sanitizeAssistant(globalSettings?.default_cli);
    setSelectedAssistant(cli);
    const modelFromGlobal = globalSettings?.cli_settings?.[cli]?.model;
    setSelectedModel(normalizeModelForAssistant(cli, modelFromGlobal));
  }, [globalSettings, usingGlobalDefaults, isInitialLoad, sanitizeAssistant, normalizeModelForAssistant]);
  
  // 用户手动切换后写入会话缓存
  useEffect(() => {
    if (!isInitialLoad && selectedAssistant && selectedModel) {
      const normalizedAssistant = sanitizeAssistant(selectedAssistant);
      sessionStorage.setItem('selectedAssistant', normalizedAssistant);
      sessionStorage.setItem('selectedModel', normalizeModelForAssistant(normalizedAssistant, selectedModel));
    }
  }, [selectedAssistant, selectedModel, isInitialLoad, sanitizeAssistant, normalizeModelForAssistant]);
  
  // 页面真正卸载时清理导航标记
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('navigationFlag');
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
  const [showAssistantDropdown, setShowAssistantDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<{ id: string; name: string; url: string; path: string; file?: File }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const router = useRouter();
  const prefetchTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assistantDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const openTaskDrawer = useCallback(() => {
    setShowAssistantDropdown(false);
    setShowModelDropdown(false);
    setTaskDrawerOpen(true);
  }, []);

  // 检查 CLI 安装状态
  useEffect(() => {
    const checkingStatus = ASSISTANT_OPTIONS.reduce<CLIStatus>((acc, cli) => {
      acc[cli.id] = {
        installed: false,
        checking: true,
        available: false,
        configured: false,
      };
      return acc;
    }, {});
    setCLIStatus(checkingStatus);

    fetchCliStatusSnapshot()
      .then((status) => setCLIStatus(status))
      .catch((error) => {
        console.error('Failed to check CLI status:', error);
        setCLIStatus(createCliStatusFallback());
      });
  }, []);

  // 点击下拉框外部时收起菜单
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;

      const assistantEl = assistantDropdownRef.current;
      if (assistantEl && !assistantEl.contains(target)) {
        setShowAssistantDropdown(false);
      }

      const modelEl = modelDropdownRef.current;
      if (modelEl && !modelEl.contains(target)) {
        setShowModelDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, []);

  // 格式化任务时间
  const formatTime = (dateString: string | null) => {
    if (!dateString) return '暂无记录';
    
    // 服务端可能返回不带 Z 的 UTC 时间，这里补齐时区避免被解析成本地时间
    let utcDateString = dateString;
    
    // 判断是否已经包含时区信息
    const hasTimezone = dateString.endsWith('Z') || 
                       dateString.includes('+') || 
                       dateString.match(/[-+]\d{2}:\d{2}$/);
    
    if (!hasTimezone) {
      // 补 Z 表示 UTC
      utcDateString = dateString + 'Z';
    }
    
    // 按 UTC 解析后计算相对时间
    const date = new Date(utcDateString);
    const now = new Date();
    // Calculate the actual time difference
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 30) return `${diffDays} 天前`;
    
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  // 格式化 CLI 和模型信息
  const formatCliInfo = (cli?: string, model?: string) => {
    const normalizedCli = sanitizeAssistant(cli);
    const assistantOption = ACTIVE_CLI_OPTIONS_MAP[normalizedCli];
    const cliName = assistantOption?.name ?? 'Claude Code';
    const modelId = normalizeModelForAssistant(normalizedCli, model);
    const modelLabel = getModelDisplayName(normalizedCli, modelId);
    return `${cliName} • ${modelLabel}`;
  };

  const formatFullTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const load = useCallback(async () => {
    try {
      const r = await fetchAPI(`${API_BASE}/api/projects`);
      if (!r.ok) {
        console.warn('Failed to load projects: HTTP', r.status);
        setProjects([]);
        return;
      }

      const payload = await r.json();
      if (payload?.success === false) {
        console.error('Failed to load projects:', payload?.error || payload?.message);
        setProjects([]);
        return;
      }

      const items: unknown[] = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
        ? payload
        : [];

      const normalized: ProjectSummary[] = items
        .filter((project): project is Record<string, unknown> => Boolean(project && typeof project === 'object'))
        .map((project) => normalizeProjectPayload(project));

      const sortedProjects = normalized.sort((a, b) => {
        const aTime = a.lastMessageAt ?? a.createdAt;
        const bTime = b.lastMessageAt ?? b.createdAt;
        if (!aTime) return 1;
        if (!bTime) return -1;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setProjects(sortedProjects);
    } catch (error) {
      console.warn('Failed to load projects:', error);
      setProjects([]);
    }
  }, [normalizeProjectPayload]);
  
  async function onCreated() { await load(); }
  
  async function start(projectId: string) {
    try {
      await fetchAPI(`${API_BASE}/api/projects/${projectId}/preview/start`, { method: 'POST' });
      await load();
    } catch (error) {
      console.warn('Failed to start project:', error);
    }
  }
  
  async function stop(projectId: string) {
    try {
      await fetchAPI(`${API_BASE}/api/projects/${projectId}/preview/stop`, { method: 'POST' });
      await load();
    } catch (error) {
      console.warn('Failed to stop project:', error);
    }
  }

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const openDeleteModal = (project: ProjectSummary) => {
    setDeleteModal({ isOpen: true, project });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, project: null });
  };

  async function deleteProject() {
    if (!deleteModal.project) return;
    
    setIsDeleting(true);
    try {
      const response = await fetchAPI(`${API_BASE}/api/projects/${deleteModal.project.id}`, { method: 'DELETE' });
      
      if (response.ok) {
        showToast('任务已删除', 'success');
        await load();
        closeDeleteModal();
      } else {
        const errorData = await response.json().catch(() => ({ detail: '删除任务失败' }));
        showToast(errorData.detail || '删除任务失败', 'error');
      }
    } catch (error) {
      console.warn('Failed to delete project:', error);
      showToast('删除任务失败，请重试', 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  async function updateProject(projectId: string, newName: string) {
    try {
      const response = await fetchAPI(`${API_BASE}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      
      if (response.ok) {
        showToast('任务名称已更新', 'success');
        await load();
        setEditingProject(null);
      } else {
        const errorData = await response.json().catch(() => ({ detail: '更新任务失败' }));
        showToast(errorData.detail || '更新任务失败', 'error');
      }
    } catch (error) {
      console.warn('Failed to update project:', error);
      showToast('更新任务失败，请重试', 'error');
    }
  }

  // Handle files (for both drag drop and file input)
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setIsUploading(true);
    
    try {
      const filesArray = Array.from(files as ArrayLike<File>);
      const imagesToAdd = filesArray
        .filter(file => file.type.startsWith('image/'))
        .map(file => ({
          id: crypto.randomUUID(),
          name: file.name,
          url: URL.createObjectURL(file),
          path: '',
          file,
        }));

      if (imagesToAdd.length > 0) {
        setUploadedImages(prev => [...prev, ...imagesToAdd]);
      }
    } catch (error) {
      console.error('Image processing failed:', error);
      showToast('Failed to process image. Please try again.', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [showToast]);

  // Handle image upload - store locally first, upload after project creation
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    await handleFiles(files);
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the container completely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  // Remove uploaded image
  const removeImage = (id: string) => {
    setUploadedImages(prev => {
      const imageToRemove = prev.find(img => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.url);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  const handleSubmit = async () => {
    if ((!prompt.trim() && uploadedImages.length === 0) || isCreatingProject) return;
    
    setIsCreatingProject(true);
    
    // Generate a unique project ID
    const projectId = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Create a new project first
      const response = await fetchAPI(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          name: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
          initialPrompt: prompt.trim(),
          preferredCli: selectedAssistant,
          selectedModel,
          quantCapabilityId: selectedCapability,
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Failed to create project:', errorData);
        showToast('Failed to create project', 'error');
        setIsCreatingProject(false);
        return;
      }
      
      const payload = await response.json();
      const projectData = (payload && typeof payload === 'object') ? (payload.data ?? payload) : payload;
      const createdProjectId: string | undefined = projectData?.id ?? projectId;
      if (!createdProjectId) {
        console.error('Create project response missing id:', payload);
        showToast('Failed to create project (invalid response)', 'error');
        setIsCreatingProject(false);
        return;
      }
      if (createdProjectId !== projectId) {
        console.warn('Project ID mismatch between request and response:', {
          requestedId: projectId,
          responseId: createdProjectId,
          payload
        });
      }
      
      // 如有图片，先上传图片
      let imageData: any[] = [];
      
      if (uploadedImages.length > 0) {
        try {
          for (let i = 0; i < uploadedImages.length; i++) {
            const image = uploadedImages[i];
            if (!image.file) continue;
            
            const formData = new FormData();
            formData.append('file', image.file);

            const uploadResponse = await fetchAPI(`${API_BASE}/api/assets/${createdProjectId}/upload`, {
              method: 'POST',
              body: formData
            });

            if (uploadResponse.ok) {
              const result = await uploadResponse.json();
              // Track image data for API
              imageData.push({
                name: result.filename || image.name,
                path: result.absolute_path,
                public_url: typeof result.public_url === 'string' ? result.public_url : undefined
              });
            }
          }
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          showToast('Images could not be uploaded, but project was created', 'error');
        }
      }
      
      // Execute initial prompt directly with images
      if (prompt.trim()) {
        try {
          const actResponse = await fetchAPI(`${API_BASE}/api/chat/${createdProjectId}/act`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instruction: prompt.trim(), // Original prompt without image paths
              images: imageData,
              isInitialPrompt: true,
              cliPreference: selectedAssistant,
              selectedModel,
              quantCapabilityId: selectedCapability,
            })
          });
          
          if (actResponse.ok) {
            // Successfully kicked off ACT with image payloads
          } else {
            console.error('❌ ACT failed:', await actResponse.text());
          }
        } catch (actError) {
          console.error('❌ ACT API error:', actError);
        }
      }
      
      // Navigate to chat page with model and CLI parameters
      uploadedImages.forEach(image => {
        if (image.url) {
          URL.revokeObjectURL(image.url);
        }
      });
      setUploadedImages([]);
      setPrompt('');

      const params = new URLSearchParams();
      if (selectedAssistant) params.set('cli', selectedAssistant);
      if (selectedModel) params.set('model', selectedModel);
      router.push(`/${createdProjectId}/chat${params.toString() ? '?' + params.toString() : ''}`);
      
    } catch (error) {
      console.error('Failed to create project:', error);
      showToast('Failed to create project', 'error');
    } finally {
      setIsCreatingProject(false);
    }
  };

  useEffect(() => { 
    load();
    
    // Handle clipboard paste for images
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }
      
      if (imageFiles.length > 0) {
        e.preventDefault();
        const fileList = {
          length: imageFiles.length,
          item: (index: number) => imageFiles[index],
          [Symbol.iterator]: function* () {
            for (let i = 0; i < imageFiles.length; i++) {
              yield imageFiles[i];
            }
          }
        } as FileList;
        
        // Convert to FileList-like object
        Object.defineProperty(fileList, 'length', { value: imageFiles.length });
        imageFiles.forEach((file, index) => {
          Object.defineProperty(fileList, index, { value: file });
        });
        
        handleFiles(fileList);
      }
    };
    
    document.addEventListener('paste', handlePaste);
    const timers = prefetchTimers.current;

    // Cleanup prefetch timers
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
      document.removeEventListener('paste', handlePaste);
    };
  }, [selectedAssistant, handleFiles, load]);

  // Update models when assistant changes
  const handleAssistantChange = (assistant: string) => {
    // Don't allow selecting uninstalled CLIs
    if (!cliStatus[assistant]?.installed) return;

    const sanitized = sanitizeAssistant(assistant);
    setUsingGlobalDefaults(false);
    setIsInitialLoad(false);
    setSelectedAssistant(sanitized);
    setSelectedModel(getDefaultModelForCli(sanitized));

    setShowAssistantDropdown(false);
  };

  const handleModelChange = (modelId: string) => {
    setUsingGlobalDefaults(false);
    setIsInitialLoad(false);
    setSelectedModel(normalizeModelForAssistant(selectedAssistant, modelId));
    setShowModelDropdown(false);
  };

  const selectedModelLabel =
    availableModels.find((model) => model.id === selectedModel)?.name ??
    getModelDisplayName(selectedAssistant, selectedModel);
  const selectedAssistantName = selectedAssistantOption?.name ?? 'Claude Code';
  const runningProjects = projects.filter((project) => project.previewUrl || project.status === 'running').length;
  const recentProjects = projects.slice(0, 8);
  const filteredProjects = projects.filter((project) => {
    const keyword = projectSearch.trim().toLowerCase();
    if (!keyword) return true;
    return [
      project.name,
      project.description,
      project.initialPrompt,
      getQuantCapability(project.quantCapabilityId).shortName,
      formatCliInfo(project.preferredCli ?? undefined, project.selectedModel ?? undefined),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));
  });
  const capabilityShortcuts = [
    {
      id: 'market',
      name: '行情分析',
      description: '价格、K 线、成交量、技术指标和阶段走势',
      prompt: '分析一只股票最近的行情、K 线、成交量和技术指标，生成可视化看板。',
    },
    {
      id: 'fundamental',
      name: '基本面研究',
      description: '财务报表、盈利质量、现金流和公告事件',
      prompt: '分析一只股票最近的财务表现、盈利质量、现金流和公告事件，生成基本面研究看板。',
    },
    {
      id: 'comparison',
      name: '标的对比',
      description: '股票、指数、ETF 的横向表现和风险比较',
      prompt: '对比多个股票、指数或 ETF 的近期表现、波动、回撤和关键指标，生成对比看板。',
    },
    {
      id: 'strategy',
      name: '策略研究',
      description: '信号规则、回测复盘、交易明细和参数假设',
      prompt: '研究一个量化交易策略，说明信号规则、样本范围、回测指标、交易明细和参数假设。',
    },
    {
      id: 'risk',
      name: '组合风控',
      description: '持仓暴露、相关性、回撤、仓位和风险约束',
      prompt: '分析一个投资组合的风险暴露、相关性、回撤、仓位和风控约束，生成组合风控看板。',
    },
  ];

  const openProject = (project: ProjectSummary) => {
    const params = new URLSearchParams();
    if (selectedAssistant) params.set('cli', selectedAssistant);
    if (selectedModel) params.set('model', selectedModel);
    router.push(`/${project.id}/chat${params.toString() ? '?' + params.toString() : ''}`);
  };

  const renderProjectItem = (project: ProjectSummary) => {
    const projectCli = sanitizeAssistant(project.preferredCli);
    const projectColor = assistantBrandColors[projectCli] || assistantBrandColors[DEFAULT_ASSISTANT];
    const capability = getQuantCapability(project.quantCapabilityId);

    return (
      <div
        key={project.id}
        className="group rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-red-100 hover:bg-red-50/70"
      >
        {editingProject?.id === project.id ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const newName = formData.get('name') as string;
              if (newName.trim()) {
                updateProject(project.id, newName.trim());
              }
            }}
            className="space-y-2"
          >
            <input
              name="name"
              defaultValue={project.name}
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 outline-none focus:border-red-400"
              autoFocus
              onBlur={() => setEditingProject(null)}
            />
            <div className="flex gap-2">
              <button type="submit" className="rounded-md bg-red-500 px-2.5 py-1 text-xs font-medium text-white">
                保存
              </button>
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
              >
                取消
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start gap-2">
            <button type="button" onClick={() => openProject(project)} className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: projectColor }}
                />
                <h3 className="truncate text-sm font-semibold text-gray-900">{project.name}</h3>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                <span>{formatTime(project.lastMessageAt || project.createdAt)}</span>
                <span>•</span>
                <span>{capability.shortName}</span>
              </div>
              <div className="mt-1 truncate text-[11px] text-gray-400">
                {formatCliInfo(projectCli, project.selectedModel ?? undefined)}
              </div>
            </button>
            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setEditingProject(project)}
                className="rounded-md p-1 text-gray-400 hover:bg-white hover:text-red-500"
                title="重命名"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => openDeleteModal(project)}
                className="rounded-md p-1 text-gray-400 hover:bg-white hover:text-red-500"
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTaskRecordItem = (project: ProjectSummary) => {
    const projectCli = sanitizeAssistant(project.preferredCli);
    const capability = getQuantCapability(project.quantCapabilityId);
    const title = project.name || project.initialPrompt || '未命名任务';
    const isEditing = editingProject?.id === project.id;

    return (
      <div
        key={project.id}
        className="group relative border-b border-gray-100 px-4 py-3 transition-colors hover:bg-gray-50"
      >
        {isEditing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const newName = String(formData.get('name') || '').trim();
              if (newName) {
                updateProject(project.id, newName);
              }
            }}
            className="space-y-2"
          >
            <input
              name="name"
              defaultValue={title}
              autoFocus
              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-950 outline-none focus:border-red-400"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setEditingProject(null);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-lg bg-gray-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
              >
                保存
              </button>
            </div>
          </form>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => openProject(project)}
              className="block w-full min-w-0 text-left"
            >
              <div className="truncate text-sm font-semibold text-gray-950">{title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                <span>{formatTime(project.lastMessageAt || project.createdAt)}</span>
                <span>@{project.id.slice(-8)}</span>
              </div>
              <div className="mt-1 truncate text-xs text-gray-400">
                {capability.shortName} · {formatCliInfo(projectCli, project.selectedModel ?? undefined)}
              </div>
            </button>
            <div className="pointer-events-none absolute right-3 top-3 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setEditingProject(project)}
                className="pointer-events-auto rounded-md p-1.5 text-gray-400 hover:bg-white hover:text-red-500"
                title="重命名任务"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => openDeleteModal(project)}
                className="pointer-events-auto rounded-md p-1.5 text-gray-400 hover:bg-white hover:text-red-500"
                title="删除任务"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTaskHistoryDrawer = () => {
    return (
      <AnimatePresence initial={false}>
        {taskDrawerOpen && (
          <motion.div
            key="task-history-drawer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-[500] bg-transparent"
            onClick={() => setTaskDrawerOpen(false)}
          >
            <motion.aside
              initial={{ x: -120, opacity: 0, scaleX: 0.94 }}
              animate={{ x: 0, opacity: 1, scaleX: 1 }}
              exit={{ x: -110, opacity: 0, scaleX: 0.96 }}
              transition={{
                type: 'spring',
                stiffness: 360,
                damping: 24,
                mass: 0.85,
              }}
              style={{ transformOrigin: 'left center' }}
              className="flex h-full w-full max-w-[420px] flex-col border-r border-gray-200 bg-white shadow-2xl"
              onClick={(event: React.MouseEvent<HTMLElement>) => event.stopPropagation()}
            >
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-gray-100 px-3">
                <div className="flex items-baseline gap-1.5">
                  <h2 className="text-base font-semibold text-gray-950">任务记录</h2>
                  <span className="text-xs text-gray-400">({projects.length})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setTaskDrawerOpen(false)}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-950"
                  title="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="border-b border-gray-100 bg-gray-50/70 px-3 py-3">
                <div className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-500">
                  <Search className="h-4 w-4 shrink-0" />
                  <input
                    value={projectSearch}
                    onChange={(event) => setProjectSearch(event.target.value)}
                    placeholder="搜索对话标题、用户或内容..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredProjects.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-gray-400">
                    暂无匹配的任务记录
                  </div>
                ) : (
                  filteredProjects.map(renderTaskRecordItem)
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const renderTaskSidebar = (isMobile = false) => (
    <aside
      className={`flex h-full flex-col border-r border-gray-200 bg-white/95 ${
        isMobile ? 'w-[286px]' : 'w-[260px]'
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
        <button
          type="button"
          onClick={openTaskDrawer}
          className="flex items-center gap-2 text-gray-950 hover:text-red-600"
          title="打开任务记录"
        >
          <Menu className="h-4 w-4" />
          <span className="text-base font-semibold text-gray-950">任务记录</span>
        </button>
        {isMobile && (
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-3 px-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">分析能力</div>
        </div>

        <div className="space-y-1">
          {capabilityShortcuts.map((capability) => (
            <button
              key={capability.id}
              type="button"
              onClick={() => {
                setPrompt(capability.prompt);
                if (isMobile) {
                  setSidebarOpen(false);
                }
              }}
              className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
              title={capability.description}
            >
              <div className="text-sm font-semibold text-gray-950">{capability.name}</div>
              <div className="mt-1 text-xs leading-5 text-gray-500">{capability.description}</div>
            </button>
          ))}
        </div>

      </div>

      <div className="border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={() => setShowGlobalSettings(true)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-950"
        >
          <Settings className="h-4 w-4" />
          模型与数据源设置
        </button>
      </div>
    </aside>
  );


  return (
    <div className="relative flex h-screen overflow-hidden bg-[#fbfbfc] text-gray-950">
      {/* 柔和底部背景，保持输入区聚焦 */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-white " />
        <div 
          className="absolute inset-0 hidden transition-all duration-1000 ease-in-out"
          style={{
            background: `radial-gradient(circle at 50% 100%, 
              ${(assistantBrandColors[selectedAssistant] || assistantBrandColors.claude)}66 0%, 
              ${(assistantBrandColors[selectedAssistant] || assistantBrandColors.claude)}4D 25%, 
              ${(assistantBrandColors[selectedAssistant] || assistantBrandColors.claude)}33 50%, 
              transparent 70%)`
          }}
        />
        {/* Light mode gradient - subtle */}
        <div 
          className="absolute inset-0 block transition-all duration-1000 ease-in-out"
          style={{
            background: `radial-gradient(circle at 50% 100%, 
              ${(assistantBrandColors[selectedAssistant] || assistantBrandColors.claude)}40 0%, 
              ${(assistantBrandColors[selectedAssistant] || assistantBrandColors.claude)}26 25%, 
              transparent 50%)`
          }}
        />
      </div>
      
      {/* 页面主体 */}
      <div className="relative z-10 flex h-full w-full">
        <div className="hidden lg:block">
          {renderTaskSidebar()}
        </div>

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="h-full" onClick={(event) => event.stopPropagation()}>
              {renderTaskSidebar(true)}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 bg-white/85 px-4 backdrop-blur md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-950 lg:hidden"
                title="打开任务记录"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-base font-bold text-white shadow-sm">
                Q
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-gray-950 md:text-lg">QuantPilot</h1>
                <div className="mt-1 hidden items-center gap-2 text-xs text-gray-500 md:flex">
                  <span>任务 {projects.length}</span>
                  <span>•</span>
                  <span>运行中 {runningProjects}</span>
                  <span>•</span>
                  <span>{selectedModelLabel}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGlobalSettings(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-950"
                title="模型与数据源设置"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </header>

          <main className="relative flex-1 overflow-y-auto">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_bottom,rgba(239,68,68,0.16),rgba(255,255,255,0)_68%)]" />
            <div className="relative mx-auto flex min-h-full w-full max-w-6xl -translate-y-6 flex-col items-center justify-center px-4 py-8 md:-translate-y-12 md:px-8 lg:-translate-y-14">
              <div className="mb-6 text-center">
                <h2 className="text-3xl font-bold tracking-normal text-red-600 md:text-5xl">
                  QuantPilot
                </h2>
                <p className="mt-3 text-sm text-gray-500 md:text-base">
                  选择能力，描述需求，等待任务完成并生成可验证的量化看板
                </p>
              </div>

              {uploadedImages.length > 0 && (
                <div className="mb-3 flex w-full max-w-4xl flex-wrap gap-2">
                  {uploadedImages.map((image, index) => (
                    <div key={image.id} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.url}
                        alt={image.name}
                        className="h-16 w-16 rounded-lg border border-gray-200 object-cover"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[10px] text-white">
                        图 {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeImage(image.id)}
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                        title="移除图片"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSubmit();
                }}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`relative w-full max-w-4xl rounded-lg border bg-white shadow-[0_18px_45px_rgba(15,23,42,0.12)] transition-colors ${
                  isDragOver ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              >
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="请输入任务，例如：贵州茅台最近财务怎么样？生成 K 线、成交量和财务看板"
                  disabled={isCreatingProject}
                  className="min-h-[128px] w-full resize-none rounded-lg bg-transparent px-5 py-4 text-[16px] leading-6 text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      if (event.metaKey || event.ctrlKey) {
                        event.preventDefault();
                        handleSubmit();
                      } else if (!event.shiftKey) {
                        event.preventDefault();
                        handleSubmit();
                      }
                    }
                  }}
                />

                {isDragOver && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-red-400 bg-red-50/90">
                    <div className="text-center text-red-600">
                      <ImageIcon className="mx-auto mb-2 h-6 w-6" />
                      <div className="text-sm font-semibold">将图片拖到这里</div>
                      <div className="mt-1 text-xs">支持 JPG、PNG、GIF、WEBP</div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-3 py-3">
                  <label
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    title="上传图片"
                  >
                    <ImageIcon className="h-4 w-4" />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      disabled={isUploading || isCreatingProject}
                      className="hidden"
                    />
                  </label>

                  <div className="relative z-[200]" ref={assistantDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAssistantDropdown(!showAssistantDropdown);
                        setShowModelDropdown(false);
                      }}
                      className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950"
                    >
                      <div className="h-4 w-4 overflow-hidden rounded">
                        <Image
                          src={selectedAssistantOption?.icon ?? '/claude.png'}
                          alt={selectedAssistantOption?.name ?? 'Claude Code'}
                          width={16}
                          height={16}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <span>{selectedAssistantName}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                    </button>

                    {showAssistantDropdown && (
                      <div className="absolute left-0 top-full z-[300] mt-2 min-w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                        {ASSISTANT_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleAssistantChange(option.id)}
                            disabled={!cliStatus[option.id]?.installed}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                              !cliStatus[option.id]?.installed
                                ? 'cursor-not-allowed text-gray-400 opacity-60'
                                : selectedAssistant === option.id
                                ? 'bg-red-50 font-semibold text-red-600'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950'
                            }`}
                          >
                            <div className="h-4 w-4 overflow-hidden rounded">
                              <Image
                                src={option.icon ?? '/claude.png'}
                                alt={option.name}
                                width={16}
                                height={16}
                                className="h-full w-full object-contain"
                              />
                            </div>
                            <span className="whitespace-nowrap">{option.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative z-[200]" ref={modelDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowModelDropdown((current) => !current);
                        setShowAssistantDropdown(false);
                      }}
                      className="flex h-9 min-w-[150px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950"
                    >
                      <span className="truncate">{selectedModelLabel}</span>
                      <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-400" />
                    </button>

                    {showModelDropdown && (
                      <div className="absolute left-0 top-full z-[300] mt-2 max-h-[300px] min-w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {availableModels.map((model) => (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => handleModelChange(model.id)}
                            className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                              selectedModel === model.id
                                ? 'bg-red-50 font-semibold text-red-600'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950'
                            }`}
                          >
                            {model.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={(!prompt.trim() && uploadedImages.length === 0) || isCreatingProject}
                    className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg bg-gray-950 text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                    title="提交任务"
                  >
                    {isCreatingProject ? (
                      <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <ArrowUp className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </form>

            </div>
          </main>
        </div>


      {/* 任务记录抽屉 */}
      {renderTaskHistoryDrawer()}

      {/* 全局设置弹窗 */}
      <GlobalSettings
        isOpen={showGlobalSettings}
        onClose={() => setShowGlobalSettings(false)}
      />

      {/* 删除任务弹窗 */}
      {deleteModal.isOpen && deleteModal.project && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '28rem',
              width: '100%',
              margin: '0 1rem',
              border: '1px solid rgb(229 231 235)'
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600 " fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 ">删除任务</h3>
                <p className="text-sm text-gray-500 ">该操作无法撤销</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-6">
              确定要删除 <strong>&quot;{deleteModal.project.name}&quot;</strong> 吗？
              该任务的项目文件与对话记录将被永久删除。
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={deleteProject}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    删除中...
                  </>
                ) : (
                  '删除任务'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 轻提示 */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
          >
            <div className={`px-6 py-4 rounded-lg shadow-lg border flex items-center gap-3 max-w-sm backdrop-blur-lg ${
              toast.type === 'success'
                ? 'bg-green-500/20 border-green-500/30 text-green-400'
                : 'bg-red-500/20 border-red-500/30 text-red-400'
            }`}>
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <p className="text-sm font-medium">{toast.message}</p>
            </div>
          </motion.div>
        </div>
      )}
      </div>
    </div>
  );
}
