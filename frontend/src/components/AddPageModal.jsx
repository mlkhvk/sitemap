import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, ChevronRight, ChevronDown, ArrowRight } from 'lucide-react';
import colors from '../colors';

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
  const [links, setLinks] = useState([]);
  const [linkInput, setLinkInput] = useState('');

  const [elements, setElements] = useState([]);
  const [selectedElementId, setSelectedElementId] = useState(null);

  const [existingEvents, setExistingEvents] = useState([]);

  const [isSaving, setIsSaving] = useState(false);

  const [activeStep, setActiveStep] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [expandedElements, setExpandedElements] = useState(new Set());

  // ============ ЗАГРУЗКА ДАННЫХ ============

  useEffect(() => {
    if (isOpen && editingPage) {
      setPageTitle(editingPage.title || '');
      setLinks(editingPage.links || []);
      if (editingPage.elements) {
        setElements(editingPage.elements);
      }
      fetchEvents();
    } else if (isOpen) {
      setPageTitle('');
      setLinks([]);
      setElements([]);
      setSelectedElementId(null);
      setActiveStep(0);
      fetchEvents();
    }
  }, [isOpen, editingPage]);

  const fetchEvents = useCallback(async () => {
    try {
      setExistingEvents([
        { id: 1, name: 'Клик' },
        { id: 2, name: 'Наведение' },
        { id: 3, name: 'Открытие' },
        { id: 4, name: 'Закрытие' },
        { id: 5, name: 'Отправка формы' },
        { id: 6, name: 'Загрузка страницы' },
      ]);
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

  const handleCreateEvent = useCallback(async (eventName) => {
    if (!eventName.trim()) {
      setSnackbar({
        open: true,
        message: 'Введите название события',
        severity: 'warning'
      });
      return null;
    }
    
    try {
      const newEvent = {
        id: Date.now(),
        name: eventName.trim()
      };
      
      setExistingEvents(prev => [...prev, newEvent]);
      
      if (selectedElementId) {
        const element = findElement(selectedElementId);
        if (element) {
          element.events.push(newEvent);
          setElements([...elements]);
        }
      }
      
      setSnackbar({
        open: true,
        message: 'Событие создано и добавлено к элементу',
        severity: 'success'
      });
      
      return newEvent;
    } catch (error) {
      console.error('Ошибка создания события:', error);
      setSnackbar({
        open: true,
        message: 'Не удалось создать событие',
        severity: 'error'
      });
      return null;
    }
  }, [selectedElementId, findElement, elements]);

  const toggleEventSelection = useCallback((eventId) => {
    if (!selectedElementId) return;
    
    const element = findElement(selectedElementId);
    if (!element) return;
    
    const eventIndex = element.events.findIndex(e => e.id === eventId);
    
    if (eventIndex === -1) {
      const event = existingEvents.find(e => e.id === eventId);
      if (event) {
        element.events.push(event);
        setSnackbar({
          open: true,
          message: `Событие "${event.name}" добавлено к элементу`,
          severity: 'success'
        });
      }
    } else {
      element.events.splice(eventIndex, 1);
      setSnackbar({
        open: true,
        message: 'Событие удалено из элемента',
        severity: 'info'
      });
    }
    
    setElements([...elements]);
  }, [selectedElementId, findElement, existingEvents, elements]);

  const handleAddLink = useCallback(() => {
    if (linkInput.trim()) {
      setLinks([...links, { url: linkInput.trim() }]);
      setLinkInput('');
    }
  }, [linkInput, links]);

  const handleRemoveLink = useCallback((index) => {
    const newLinks = links.filter((_, i) => i !== index);
    setLinks(newLinks);
  }, [links]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    
    if (!pageTitle.trim()) {
      setSnackbar({
        open: true,
        message: 'Введите название страницы',
        severity: 'warning'
      });
      setActiveStep(0);
      return;
    }
    
    if (elements.length === 0) {
      setSnackbar({
        open: true,
        message: 'Добавьте хотя бы один элемент',
        severity: 'warning'
      });
      setActiveStep(1);
      return;
    }
    
    setIsSaving(true);
    try {
      const pageData = {
        title: pageTitle,
        links: links,
        elements: elements,
        project_id: Number(projectId),
        parent_page_id: null,
        sort_order: 0,
      };
      
      if (editingPage) {
        await onUpdatePage(editingPage.id, pageData);
        setSnackbar({
          open: true,
          message: 'Страница успешно обновлена!',
          severity: 'success'
        });
      } else {
        await onSavePage(pageData);
        setSnackbar({
          open: true,
          message: 'Страница успешно создана!',
          severity: 'success'
        });
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

  const renderElementTree = (tree = elements, level = 0) => {
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
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                const name = prompt('Введите имя дочернего элемента:');
                if (name) addSubElement(element.id, name);
              }}
              className="bg-transparent border-none cursor-pointer p-1"
              style={{ color: colors.primary }}
            >
              <Plus size={16} />
            </button>
            
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
          </div>
          
          {hasChildren && isExpanded && (
            <div className="mt-1">
              {renderElementTree(element.children, level + 1)}
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
          <input
            type="text"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddLink()}
            placeholder="Пример: /science/schools"
            className="w-full px-4 py-3 rounded-lg text-base outline-none transition-colors bg-white"
            style={{
              border: `1px solid ${colors.lightGray}`,
              color: colors.black,
            }}
            onFocus={(e) => e.target.style.borderColor = colors.primary}
            onBlur={(e) => e.target.style.borderColor = colors.lightGray}
          />
        </div>

        <button
          onClick={handleAddLink}
          className="flex items-center gap-2 bg-transparent border-none text-base font-medium p-2 mb-4 self-start transition-opacity hover:opacity-70"
          style={{ color: colors.primary }}
        >
          <Plus size={20} />
          Добавить ещё ссылки
        </button>

        {links.length > 0 && (
          <div className="mb-6">
            {links.map((link, index) => (
              <div
                key={index}
                className="flex justify-between items-center px-3.5 py-2.5 rounded-lg mb-1.5"
                style={{
                  backgroundColor: colors.blue,
                  border: `1px solid ${colors.lightGray}`,
                }}
              >
                <span className="text-sm" style={{ color: colors.black }}>{link.url}</span>
                <button
                  onClick={() => handleRemoveLink(index)}
                  className="bg-transparent border-none cursor-pointer p-1"
                  style={{ color: colors.error }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

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
            renderElementTree()
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
    return (
      <div className="flex flex-col min-h-[400px]">
        <h3 className="text-xl font-semibold text-center mb-4" style={{ color: colors.primary }}>
          Управление событиями
        </h3>
        
        {selectedElementId ? (
          <div className="flex-1">
            <div className="px-4 py-3 rounded-lg mb-4" style={{
              backgroundColor: colors.blue,
              border: `1px solid ${colors.primary}`,
            }}>
              Управление событиями для элемента: <strong style={{ color: colors.primary }}>{findElement(selectedElementId)?.name}</strong>
            </div>
            
            <div className="rounded-lg p-4 mb-4" style={{
              border: `1px solid ${colors.lightGray}`,
              backgroundColor: colors.white,
            }}>
              <h4 className="text-base font-semibold mb-3" style={{ color: colors.black }}>
                Текущие события элемента:
              </h4>
              <div className="flex flex-wrap gap-2">
                {findElement(selectedElementId)?.events?.length > 0 ? (
                  findElement(selectedElementId).events.map((event) => (
                    <div
                      key={event.id}
                      className="px-3.5 py-1.5 rounded-full flex items-center gap-2 text-sm"
                      style={{
                        backgroundColor: colors.primary,
                        color: colors.white,
                      }}
                    >
                      {event.name}
                      <button
                        onClick={() => toggleEventSelection(event.id)}
                        className="bg-transparent border-none text-white cursor-pointer text-base p-0 px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <p style={{ color: colors.secondaryText }}>Нет привязанных событий</p>
                )}
              </div>
            </div>
            
            <hr className="my-4" style={{ borderColor: colors.lightGray }} />
            
            <div className="mb-4">
              <h4 className="text-base font-semibold mb-2" style={{ color: colors.black }}>
                Создать новое событие:
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="new-event-name"
                  placeholder="Название события"
                  className="flex-1 px-3 py-2.5 rounded-lg text-base outline-none transition-colors bg-white"
                  style={{
                    border: `1px solid ${colors.lightGray}`,
                    color: colors.black,
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.primary}
                  onBlur={(e) => e.target.style.borderColor = colors.lightGray}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateEvent(e.target.value);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('new-event-name');
                    if (input) {
                      handleCreateEvent(input.value);
                      input.value = '';
                    }
                  }}
                  className="border-none rounded-lg cursor-pointer font-medium px-5 py-2.5"
                  style={{
                    backgroundColor: colors.success,
                    color: colors.white,
                  }}
                >
                  Создать
                </button>
              </div>
            </div>
            
            <div>
              <h4 className="text-base font-semibold mb-2" style={{ color: colors.black }}>
                Выбрать существующее событие:
              </h4>
              <div className="flex flex-wrap gap-2">
                {existingEvents
                  .filter(event => 
                    !findElement(selectedElementId)?.events?.some(e => e.id === event.id)
                  )
                  .map((event) => (
                    <button
                      key={event.id}
                      onClick={() => toggleEventSelection(event.id)}
                      className="px-3.5 py-1.5 rounded-full cursor-pointer text-sm transition-all"
                      style={{
                        backgroundColor: colors.white,
                        border: `1px solid ${colors.primary}`,
                        color: colors.primary,
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = colors.primary;
                        e.target.style.color = colors.white;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = colors.white;
                        e.target.style.color = colors.primary;
                      }}
                    >
                      {event.name}
                    </button>
                  ))}
                {existingEvents.every(event => 
                  findElement(selectedElementId)?.events?.some(e => e.id === event.id)
                ) && (
                  <p style={{ color: colors.secondaryText }}>Все события уже добавлены</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 rounded-lg mb-4" style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
          }}>
            Выберите элемент на предыдущем шаге
          </div>
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