import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Trash2, ChevronRight, ChevronDown, ArrowRight, Calendar, Search } from 'lucide-react';
import colors from '../colors';
import { getEvents } from '../services/api';

const PeriodicityDropdown = ({ value, onChange, options, placeholder = 'Периодичность' }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm cursor-pointer whitespace-nowrap bg-white"
        style={{
          border: `1px solid ${open ? colors.primary : colors.lightGray}`,
          color: value ? colors.black : colors.secondaryText,
        }}
      >
        {value || placeholder}
        <ChevronDown size={14} style={{ color: colors.secondaryText }} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-10 mt-1 rounded-lg shadow-lg overflow-hidden"
          style={{ border: `1px solid ${colors.lightGray}`, backgroundColor: colors.white, minWidth: '170px' }}
        >
          {options.map((option) => (
            <div
              key={option || '__empty'}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="px-3 py-2.5 text-sm cursor-pointer transition-colors"
              style={{
                backgroundColor: option === value ? colors.blue : colors.white,
                color: colors.black,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.blue; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = option === value ? colors.blue : colors.white; }}
            >
              {option || '—'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AddPageModal = ({
  isOpen,
  onClose,
  projectId,
  onSavePage,
  onUpdatePage,
  editingPage = null,
}) => {
  // ============ STATE ============
  const [pageTitle, setPageTitle] = useState('');
  const [links, setLinks] = useState(['']);

  const [elements, setElements] = useState([]);
  const [selectedElementId, setSelectedElementId] = useState(null);

  const [existingEvents, setExistingEvents] = useState([]);

  const [isSaving, setIsSaving] = useState(false);

  const [activeStep, setActiveStep] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [expandedElements, setExpandedElements] = useState(new Set());
  const [addingSubElementId, setAddingSubElementId] = useState(null);
  const [subElementName, setSubElementName] = useState('');

  const [eventType, setEventType] = useState('irregular'); // 'regular' | 'irregular'
  const [newEventName, setNewEventName] = useState('');
  const [newEventPeriodicity, setNewEventPeriodicity] = useState('Ежегодно');
  const [newEventDate, setNewEventDate] = useState('');
  const [eventSearch, setEventSearch] = useState('');

  const periodicityOptions = ['Ежегодно', 'Ежемесячно', 'Раз в квартал', 'Еженедельно'];

  // ============ ЗАГРУЗКА ДАННЫХ ============

  useEffect(() => {
    if (isOpen && editingPage) {
      setPageTitle(editingPage.title || '');
      setLinks(
        editingPage.links && editingPage.links.length > 0
          ? editingPage.links.map((link) => link.url)
          : ['']
      );
      if (editingPage.elements) {
        setElements(editingPage.elements);
      }
      setAddingSubElementId(null);
      setSubElementName('');
      setEventType('irregular');
      setNewEventName('');
      setNewEventPeriodicity('Ежегодно');
      setNewEventDate('');
      setEventSearch('');
      fetchEvents();
    } else if (isOpen) {
      setPageTitle('');
      setLinks(['']);
      setElements([]);
      setSelectedElementId(null);
      setActiveStep(0);
      setAddingSubElementId(null);
      setSubElementName('');
      setEventType('irregular');
      setNewEventName('');
      setNewEventPeriodicity('Ежегодно');
      setNewEventDate('');
      setEventSearch('');
      fetchEvents();
    }
  }, [isOpen, editingPage]);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await getEvents();
      setExistingEvents(response.data || []);
    } catch (error) {
      console.error('Ошибка загрузки событий:', error);
    }
  }, []);

  const findElement = useCallback((id, tree = elements) => {
    for (const element of tree) {
      if (element.id === id) return element;
      if (element.children) {
        const found = findElement(id, element.children);
        if (found) return found;
      }
    }
    return null;
  }, [elements]);

  const deleteElementFromTree = useCallback((id, tree = elements) => {
    for (let i = 0; i < tree.length; i++) {
      if (tree[i].id === id) {
        tree.splice(i, 1);
        setElements([...elements]);
        if (selectedElementId === id) {
          setSelectedElementId(null);
        }
        return true;
      }
      if (tree[i].children) {
        const found = deleteElementFromTree(id, tree[i].children);
        if (found) {
          setElements([...elements]);
          return true;
        }
      }
    }
    return false;
  }, [elements, selectedElementId]);

  const addElement = useCallback((name) => {
    const newElement = {
      id: Date.now(),
      name: name,
      parent_element_id: null,
      children: [],
      events: []
    };
    setElements([...elements, newElement]);
  }, [elements]);

  const addSubElement = useCallback((parentId, name) => {
    const parent = findElement(parentId);
    if (parent) {
      const newElement = {
        id: Date.now(),
        name: name,
        parent_element_id: parentId,
        children: [],
        events: []
      };
      parent.children.push(newElement);
      setElements([...elements]);
      setExpandedElements(prev => new Set(prev).add(parentId));
    }
  }, [elements, findElement]);

  const handleCreateEvent = useCallback(() => {
    if (!newEventName.trim()) {
      return;
    }

    const newEvent = eventType === 'regular'
      ? {
          id: Date.now(),
          name: newEventName.trim(),
          type: 'regular',
          periodicity: newEventPeriodicity,
          date: newEventDate,
        }
      : {
          id: Date.now(),
          name: newEventName.trim(),
          type: 'irregular',
        };

    setExistingEvents(prev => [...prev, newEvent]);
    setNewEventName('');
    setNewEventDate('');
  }, [eventType, newEventName, newEventPeriodicity, newEventDate]);

  const handleUpdateEventField = useCallback((eventId, field, value) => {
    const event = existingEvents.find(e => e.id === eventId);
    if (event) {
      event[field] = value;
      setExistingEvents([...existingEvents]);
    }
  }, [existingEvents]);

  const removeEventEverywhere = useCallback((eventId, tree = elements) => {
    tree.forEach((element) => {
      element.events = element.events.filter(e => e.id !== eventId);
      if (element.children && element.children.length) {
        removeEventEverywhere(eventId, element.children);
      }
    });
  }, [elements]);

  const handleDeleteEvent = useCallback((eventId) => {
    removeEventEverywhere(eventId);
    setElements([...elements]);
    setExistingEvents(existingEvents.filter(e => e.id !== eventId));
  }, [elements, existingEvents, removeEventEverywhere]);

  const toggleEventSelection = useCallback((eventId) => {
    if (!selectedElementId) return;
    
    const element = findElement(selectedElementId);
    if (!element) return;
    
    const eventIndex = element.events.findIndex(e => e.id === eventId);
    
    if (eventIndex === -1) {
      const event = existingEvents.find(e => e.id === eventId);
      if (event) {
        element.events.push(event);
      }
    } else {
      element.events.splice(eventIndex, 1);
    }
    
    setElements([...elements]);
  }, [selectedElementId, findElement, existingEvents, elements]);

  // ============ ССЫЛКИ ============

  const handleLinkChange = useCallback((index, value) => {
    setLinks((prev) => {
      const newLinks = [...prev];
      newLinks[index] = value;
      return newLinks;
    });
  }, []);

  const handleAddLink = useCallback(() => {
    setLinks((prev) => [...prev, '']);
  }, []);

  const handleRemoveLink = useCallback((index) => {
    setLinks((prev) => {
      if (prev.length === 1) {
        return [''];
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    
    if (!pageTitle.trim()) {
      setActiveStep(0);
      return;
    }
    
    if (elements.length === 0) {
      setActiveStep(1);
      return;
    }
    
    setIsSaving(true);
    try {
      const pageData = {
        title: pageTitle,
        links: links.filter((url) => url.trim()).map((url) => ({ url: url.trim() })),
        elements: elements,
        project_id: Number(projectId),
        parent_page_id: null,
        sort_order: 0,
      };
      
      if (editingPage) {
        await onUpdatePage(editingPage.id, pageData);
      } else {
        await onSavePage(projectId, pageData);
      }
      
      setTimeout(() => {
        onClose(true);
      }, 1500);
      
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      setSnackbar({
        open: true,
        message: 'Ошибка при сохранении страницы',
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, pageTitle, links, elements, editingPage, projectId, onSavePage, onUpdatePage, onClose]);

  const renderElementTree = (tree = elements, level = 0, showActions = true) => {
    return tree.map(element => {
      const hasChildren = element.children && element.children.length > 0;
      const isExpanded = expandedElements.has(element.id);
      const isSelected = selectedElementId === element.id;
      
      return (
        <div key={element.id} style={{ marginLeft: `${level * 20}px` }} className="mb-1.5">
          <div
            className={`flex items-center p-2 rounded-lg cursor-pointer gap-2 transition-all`}
            style={{
              backgroundColor: isSelected ? colors.blue : colors.white,
              border: isSelected ? `2px solid ${colors.primary}` : `1px solid ${colors.lightGray}`,
            }}
            onClick={() => setSelectedElementId(element.id)}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedElements(prev => {
                    const newSet = new Set(prev);
                    if (isExpanded) {
                      newSet.delete(element.id);
                    } else {
                      newSet.add(element.id);
                    }
                    return newSet;
                  });
                }}
                className="bg-transparent border-none cursor-pointer p-0.5 flex items-center"
              >
                {isExpanded ? 
                  <ChevronDown size={16} style={{ color: colors.primary }} /> : 
                  <ChevronRight size={16} style={{ color: colors.primary }} />
                }
              </button>
            )}
            
            <span className="text-base" style={{ 
              color: colors.primary,
              fontWeight: isSelected ? '600' : '400'
            }}>
              {element.name}
            </span>
            
            {element.events && element.events.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs ml-auto" style={{
                backgroundColor: colors.primary,
                color: colors.white,
              }}>
                {element.events.length} событий
              </span>
            )}
            
            {showActions && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingSubElementId(element.id);
                  setSubElementName('');
                  setExpandedElements(prev => new Set(prev).add(element.id));
                }}
                className="bg-transparent border-none cursor-pointer p-1"
                style={{ color: colors.primary }}
              >
                <Plus size={16} />
              </button>
            )}
            
            {showActions && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Удалить элемент "${element.name}"?`)) {
                    deleteElementFromTree(element.id);
                  }
                }}
                className="bg-transparent border-none cursor-pointer p-1"
                style={{ color: colors.error }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {showActions && addingSubElementId === element.id && (
            <div style={{ marginLeft: '20px' }} className="flex items-center gap-2 mt-1.5">
              <input
                type="text"
                autoFocus
                value={subElementName}
                onChange={(e) => setSubElementName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (subElementName.trim()) {
                      addSubElement(element.id, subElementName.trim());
                    }
                    setAddingSubElementId(null);
                    setSubElementName('');
                  } else if (e.key === 'Escape') {
                    setAddingSubElementId(null);
                    setSubElementName('');
                  }
                }}
                placeholder="Название подэлемента"
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-colors bg-white"
                style={{
                  border: `1px solid ${colors.primary}`,
                  color: colors.black,
                }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (subElementName.trim()) {
                    addSubElement(element.id, subElementName.trim());
                  }
                  setAddingSubElementId(null);
                  setSubElementName('');
                }}
                className="border-none rounded-lg cursor-pointer font-medium p-2"
                style={{ backgroundColor: colors.primary, color: colors.white }}
              >
                <Plus size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingSubElementId(null);
                  setSubElementName('');
                }}
                className="bg-transparent border-none cursor-pointer p-1"
                style={{ color: colors.secondaryText }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {hasChildren && isExpanded && (
            <div className="mt-1">
              {renderElementTree(element.children, level + 1, showActions)}
            </div>
          )}
        </div>
      );
    });
  };

  // ============ РЕНДЕР ШАГА 1 ============

  const renderStep1 = () => {
    return (
      <div className="flex flex-col min-h-[400px]">
        <h2 className="text-2xl font-semibold text-center mb-8" style={{ color: colors.primary }}>
          Добавление страницы
        </h2>

        <div className="mb-6">
          <label className="block text-base font-medium mb-2" style={{ color: colors.black }}>
            Введите название страницы:
          </label>
          <input
            type="text"
            value={pageTitle}
            onChange={(e) => setPageTitle(e.target.value)}
            placeholder="Пример: Контакты"
            className="w-full px-4 py-3 rounded-lg text-base outline-none transition-colors bg-white"
            style={{
              border: `1px solid ${colors.lightGray}`,
              color: colors.black,
            }}
            onFocus={(e) => e.target.style.borderColor = colors.primary}
            onBlur={(e) => e.target.style.borderColor = colors.lightGray}
          />
        </div>

        <div className="mb-4">
          <label className="block text-base font-medium mb-2" style={{ color: colors.black }}>
            Введите полную ссылку страницы:
          </label>

          {links.map((link, index) => (
            <div key={index} className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={link}
                onChange={(e) => handleLinkChange(index, e.target.value)}
                placeholder="Пример: /science/schools"
                className="flex-1 px-4 py-3 rounded-lg text-base outline-none transition-colors bg-white"
                style={{
                  border: `1px solid ${colors.lightGray}`,
                  color: colors.black,
                }}
                onFocus={(e) => e.target.style.borderColor = colors.primary}
                onBlur={(e) => e.target.style.borderColor = colors.lightGray}
              />
              {links.length > 1 && (
                <button
                  onClick={() => handleRemoveLink(index)}
                  className="bg-transparent border-none cursor-pointer p-1"
                  style={{ color: colors.secondaryText }}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleAddLink}
          className="flex items-center gap-2 bg-transparent border-none text-base font-medium p-2 mb-4 self-start transition-opacity hover:opacity-70"
          style={{ color: colors.primary }}
        >
          <Plus size={20} />
          Добавить ещё ссылки
        </button>

        <div className="flex justify-between items-center mt-auto pt-6" style={{ borderTop: `1px solid ${colors.lightGray}` }}>
          <span className="text-sm font-medium" style={{ color: colors.primary }}>1/4</span>
          <button
            onClick={() => setActiveStep(1)}
            disabled={!pageTitle.trim()}
            className={`flex items-center gap-2 px-7 py-2.5 rounded-lg text-base font-medium transition-all ${
              pageTitle.trim() ? 'cursor-pointer' : 'cursor-not-allowed'
            }`}
            style={{
              backgroundColor: pageTitle.trim() ? colors.primary : colors.lightGray,
              color: pageTitle.trim() ? colors.white : colors.secondaryText,
            }}
          >
            Далее
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  };

  // ============ РЕНДЕР ШАГА 2 ============

  const renderStep2 = () => {
    return (
      <div className="flex flex-col min-h-[400px]">
        <h3 className="text-xl font-semibold text-center mb-4" style={{ color: colors.primary }}>
          Добавление элементов
        </h3>
        
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            id="element-name-input"
            placeholder="Введите имя элемента"
            className="flex-1 px-3 py-2.5 rounded-lg text-base outline-none transition-colors bg-white"
            style={{
              border: `1px solid ${colors.lightGray}`,
              color: colors.black,
            }}
            onFocus={(e) => e.target.style.borderColor = colors.primary}
            onBlur={(e) => e.target.style.borderColor = colors.lightGray}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                const name = e.target.value;
                if (name) {
                  addElement(name);
                  e.target.value = '';
                }
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.getElementById('element-name-input');
              if (input && input.value) {
                addElement(input.value);
                input.value = '';
              }
            }}
            className="border-none rounded-lg cursor-pointer font-medium px-5 py-2.5"
            style={{
              backgroundColor: colors.primary,
              color: colors.white,
            }}
          >
            <Plus size={20} />
          </button>
        </div>
        
        <div className="rounded-lg p-4 max-h-[300px] overflow-auto flex-1" style={{
          border: `1px solid ${colors.lightGray}`,
          backgroundColor: colors.white,
        }}>
          {elements.length === 0 ? (
            <p className="text-center py-5" style={{ color: colors.secondaryText }}>
              Нет элементов. Добавьте корневой элемент.
            </p>
          ) : (
            renderElementTree()
          )}
        </div>
        
        <div className="flex justify-between items-center mt-5 pt-5" style={{ borderTop: `1px solid ${colors.lightGray}` }}>
          <span className="text-sm font-medium" style={{ color: colors.primary }}>2/4</span>
          <div className="flex gap-3">
            <button
              onClick={() => setActiveStep(0)}
              className="px-6 py-2.5 border-none rounded-lg cursor-pointer font-medium"
              style={{
                backgroundColor: colors.lightGray,
                color: colors.black,
              }}
            >
              Назад
            </button>
            <button
              onClick={() => setActiveStep(2)}
              disabled={elements.length === 0}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium ${
                elements.length > 0 ? 'cursor-pointer' : 'cursor-not-allowed'
              }`}
              style={{
                backgroundColor: elements.length > 0 ? colors.primary : colors.lightGray,
                color: elements.length > 0 ? colors.white : colors.secondaryText,
              }}
            >
              Далее
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============ РЕНДЕР ШАГА 3 ============

  const renderStep3 = () => {
    return (
      <div className="flex flex-col min-h-[400px]">
        <h3 className="text-xl font-semibold text-center mb-4" style={{ color: colors.primary }}>
          Выбор элемента для работы с событиями
        </h3>
        
        <p className="text-center mb-4" style={{ color: colors.secondaryText }}>
          Выберите элемент из списка, чтобы управлять его событиями
        </p>
        
        <div className="rounded-lg p-4 max-h-[300px] overflow-auto flex-1" style={{
          border: `1px solid ${colors.lightGray}`,
          backgroundColor: colors.white,
        }}>
          {elements.length === 0 ? (
            <p className="text-center py-5" style={{ color: colors.secondaryText }}>
              Нет элементов для выбора
            </p>
          ) : (
            renderElementTree(elements, 0, false)
          )}
        </div>
        
        {selectedElementId && (
          <div className="mt-3 px-4 py-3 rounded-lg" style={{
            backgroundColor: colors.blue,
            border: `1px solid ${colors.primary}`,
          }}>
            Выбран элемент: <strong style={{ color: colors.primary }}>{findElement(selectedElementId)?.name}</strong>
          </div>
        )}
        
        <div className="flex justify-between items-center mt-5 pt-5" style={{ borderTop: `1px solid ${colors.lightGray}` }}>
          <span className="text-sm font-medium" style={{ color: colors.primary }}>3/4</span>
          <div className="flex gap-3">
            <button
              onClick={() => setActiveStep(1)}
              className="px-6 py-2.5 border-none rounded-lg cursor-pointer font-medium"
              style={{
                backgroundColor: colors.lightGray,
                color: colors.black,
              }}
            >
              Назад
            </button>
            <button
              onClick={() => setActiveStep(3)}
              disabled={!selectedElementId}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium ${
                selectedElementId ? 'cursor-pointer' : 'cursor-not-allowed'
              }`}
              style={{
                backgroundColor: selectedElementId ? colors.primary : colors.lightGray,
                color: selectedElementId ? colors.white : colors.secondaryText,
              }}
            >
              Далее
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============ РЕНДЕР ШАГА 4 ============

  const renderStep4 = () => {
    const selectedElement = selectedElementId ? findElement(selectedElementId) : null;
    const filteredEvents = existingEvents.filter((event) =>
      event.name.toLowerCase().includes(eventSearch.trim().toLowerCase())
    );

    return (
      <div className="flex flex-col min-h-[400px]">
        {selectedElement && (
          <div className="px-4 py-3 rounded-lg mb-4" style={{
            backgroundColor: colors.blue,
            border: `1px solid ${colors.primary}`,
          }}>
            События для элемента: <strong style={{ color: colors.primary }}>{selectedElement.name}</strong>
          </div>
        )}

        <label className="block text-base font-medium mb-2" style={{ color: colors.black }}>
          Создайте или выберите события:
        </label>

        <div className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
            placeholder="Название события"
            className="flex-1 px-4 py-3 rounded-lg text-base outline-none transition-colors bg-white"
            style={{
              border: `1px solid ${colors.lightGray}`,
              color: colors.black,
            }}
            onFocus={(e) => e.target.style.borderColor = colors.primary}
            onBlur={(e) => e.target.style.borderColor = colors.lightGray}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateEvent()}
          />

          {eventType === 'regular' && (
            <>
              <PeriodicityDropdown
                value={newEventPeriodicity}
                onChange={setNewEventPeriodicity}
                options={periodicityOptions}
              />

              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white"
                style={{ border: `1px solid ${colors.lightGray}` }}
              >
                <Calendar size={18} style={{ color: colors.primary, flexShrink: 0 }} />
                <input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="outline-none border-none bg-transparent text-sm"
                  style={{ color: colors.black, width: '120px' }}
                />
              </div>
            </>
          )}

          <button
            onClick={handleCreateEvent}
            className="border-none rounded-lg cursor-pointer font-medium px-4 py-3"
            style={{ backgroundColor: colors.primary, color: colors.white }}
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setEventType('regular')}
            className="w-9 h-9 rounded-lg border-none cursor-pointer font-semibold"
            style={{
              backgroundColor: eventType === 'regular' ? colors.primary : colors.lightGray,
              color: eventType === 'regular' ? colors.white : colors.black,
            }}
          >
            Р
          </button>
          <button
            onClick={() => setEventType('irregular')}
            className="w-9 h-9 rounded-lg border-none cursor-pointer font-semibold"
            style={{
              backgroundColor: eventType === 'irregular' ? colors.primary : colors.lightGray,
              color: eventType === 'irregular' ? colors.white : colors.black,
            }}
          >
            Н
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white mb-2" style={{ border: `1px solid ${colors.lightGray}` }}>
          <Search size={18} style={{ color: colors.secondaryText }} />
          <input
            type="text"
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            placeholder="Поиск.."
            className="flex-1 outline-none border-none bg-transparent text-base"
            style={{ color: colors.black }}
          />
        </div>

        <div className="rounded-lg p-3 max-h-[260px] overflow-auto flex-1" style={{
          border: `1px solid ${colors.lightGray}`,
          backgroundColor: colors.white,
        }}>
          {filteredEvents.length === 0 ? (
            <p className="text-center py-5" style={{ color: colors.secondaryText }}>
              Событий не найдено
            </p>
          ) : (
            filteredEvents.map((event) => {
              const isLinked = !!selectedElement?.events?.some((e) => e.id === event.id);
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-2"
                  style={{ border: `1px solid ${colors.lightGray}`, backgroundColor: colors.white }}
                >
                  <input
                    type="text"
                    value={event.name}
                    onChange={(e) => handleUpdateEventField(event.id, 'name', e.target.value)}
                    className="flex-1 outline-none border-none bg-transparent text-base"
                    style={{ color: colors.black }}
                  />

                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    className="bg-transparent border-none cursor-pointer p-1"
                    style={{ color: colors.secondaryText }}
                  >
                    <X size={18} />
                  </button>

                  {event.type === 'regular' && (
                    <>
                      <PeriodicityDropdown
                        value={event.periodicity || ''}
                        onChange={(val) => handleUpdateEventField(event.id, 'periodicity', val)}
                        options={['', ...periodicityOptions]}
                        placeholder="—"
                      />

                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white"
                        style={{ border: `1px solid ${colors.lightGray}` }}
                      >
                        <Calendar size={15} style={{ color: colors.primary, flexShrink: 0 }} />
                        <input
                          type="date"
                          value={event.date || ''}
                          onChange={(e) => handleUpdateEventField(event.id, 'date', e.target.value)}
                          className="outline-none border-none bg-transparent text-sm"
                          style={{ color: colors.black, width: '108px' }}
                        />
                      </div>
                    </>
                  )}

                  <button
                    onClick={() => selectedElementId && toggleEventSelection(event.id)}
                    disabled={!selectedElementId}
                    className="w-6 h-6 rounded flex-shrink-0"
                    style={{
                      backgroundColor: isLinked ? colors.primary : colors.white,
                      border: `1px solid ${colors.primary}`,
                      cursor: selectedElementId ? 'pointer' : 'not-allowed',
                      opacity: selectedElementId ? 1 : 0.5,
                    }}
                  />
                </div>
              );
            })
          )}
        </div>

        {!selectedElementId && (
          <p className="text-sm mt-2" style={{ color: colors.secondaryText }}>
            Выберите элемент на предыдущем шаге, чтобы привязывать к нему события
          </p>
        )}

        <div className="flex justify-between items-center mt-5 pt-5" style={{ borderTop: `1px solid ${colors.lightGray}` }}>
          <span className="text-sm font-medium" style={{ color: colors.primary }}>4/4</span>
          <div className="flex gap-3">
            <button
              onClick={() => setActiveStep(2)}
              className="px-6 py-2.5 border-none rounded-lg cursor-pointer font-medium"
              style={{
                backgroundColor: colors.lightGray,
                color: colors.black,
              }}
            >
              Назад
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || elements.length === 0}
              className={`px-6 py-2.5 rounded-lg font-medium ${
                (isSaving || elements.length === 0) ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
              style={{
                backgroundColor: (isSaving || elements.length === 0) ? colors.lightGray : colors.success,
                color: (isSaving || elements.length === 0) ? colors.secondaryText : colors.white,
              }}
            >
              {isSaving ? 'Сохранение...' : (editingPage ? 'Обновить страницу' : 'Сохранить страницу')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============ ОСНОВНОЙ РЕНДЕР ============

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-[9999] p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          if (window.confirm('Закрыть модальное окно? Несохраненные данные будут потеряны.')) {
            onClose(false);
          }
        }
      }}
    >
      <div className="rounded-2xl p-8 max-w-[600px] w-full max-h-[90vh] overflow-auto relative shadow-2xl" style={{
        backgroundColor: colors.white,
      }}>
        <div className="flex justify-end mb-2">
          <button
            onClick={() => {
              if (!isSaving) {
                if (window.confirm('Закрыть модальное окно? Несохраненные данные будут потеряны.')) {
                  onClose(false);
                }
              }
            }}
            className={`bg-transparent border-none p-1 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <X size={24} style={{ color: colors.black }} />
          </button>
        </div>

        {activeStep === 0 && renderStep1()}
        {activeStep === 1 && renderStep2()}
        {activeStep === 2 && renderStep3()}
        {activeStep === 3 && renderStep4()}

        {snackbar.open && (
          <div
            className={`absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[200px] justify-center ${
              snackbar.severity === 'success' ? 'text-white' :
              snackbar.severity === 'error' ? 'text-white' :
              snackbar.severity === 'warning' ? 'text-black' :
              'text-white'
            }`}
            style={{
              backgroundColor: snackbar.severity === 'success' ? colors.success :
                              snackbar.severity === 'error' ? colors.error :
                              snackbar.severity === 'warning' ? '#ffc107' :
                              '#17a2b8',
            }}
          >
            <span>{snackbar.message}</span>
            <button
              onClick={() => setSnackbar({ ...snackbar, open: false })}
              className="bg-transparent border-none cursor-pointer text-lg px-1"
              style={{
                color: snackbar.severity === 'warning' ? colors.black : colors.white,
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddPageModal;