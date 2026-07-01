import React, { useState, useEffect } from 'react';
import colors from '../colors';
import { getEvents, createEvent, createElement, getEventElements, deleteElement, updateElement } from '../services/api';

function AddPageModal({ isOpen, onClose, onSave, projectId, onSavePage, editingPage }) {
  const [step, setStep] = useState(1);
  const [pageTitle, setPageTitle] = useState('');
  const [links, setLinks] = useState(['']);
  const [elements, setElements] = useState([]);
  const [newElementName, setNewElementName] = useState('');
  const [activeSubInput, setActiveSubInput] = useState(null);
  const [subElementName, setSubElementName] = useState('');
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSavingElements, setIsSavingElements] = useState(false);
  
  // 4 этап
  const [eventType, setEventType] = useState('irregular');
  const [newEventName, setNewEventName] = useState('');
  const [periodicity, setPeriodicity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [existingEvents, setExistingEvents] = useState([]);
  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Загрузка существующих событий
  useEffect(() => {
    if (isOpen && step === 4) {
      fetchEvents();
    }
  }, [isOpen, step]);

  // Загрузка данных при редактировании
  useEffect(() => {
    if (isOpen && editingPage) {
      loadEditingData();
    }
  }, [isOpen, editingPage]);

  const fetchEvents = async () => {
    try {
      const response = await getEvents();
      setExistingEvents(response.data);
    } catch (error) {
      console.error('Ошибка загрузки событий:', error);
    }
  };

  const loadEditingData = async () => {
    try {
      setPageTitle(editingPage.title || '');
      setLinks(editingPage.links && editingPage.links.length > 0 ? editingPage.links : ['']);
      
      if (editingPage.elements && editingPage.elements.length > 0) {
        setElements(editingPage.elements);
        
        // Выбираем первый элемент по умолчанию
        const firstElementId = editingPage.elements[0]?.id;
        if (firstElementId) {
          setSelectedElementId(firstElementId);
          await loadElementEvents(firstElementId);
        }
      }
      
      setStep(1);
    } catch (error) {
      console.error('Ошибка загрузки данных для редактирования:', error);
    }
  };

  const loadElementEvents = async (elementId) => {
    try {
      const response = await getEventElements(elementId);
      const eventIds = response.data.map(ee => ee.event_id);
      setSelectedEventIds(eventIds);
    } catch (error) {
      console.error('Ошибка загрузки событий элемента:', error);
    }
  };

  // Сброс состояния при открытии модального окна (только для нового)
  useEffect(() => {
    if (isOpen && !editingPage) {
      setStep(1);
      setPageTitle('');
      setLinks(['']);
      setElements([]);
      setNewElementName('');
      setActiveSubInput(null);
      setSubElementName('');
      setSelectedElementId(null);
      setSearchQuery('');
      setEventType('irregular');
      setNewEventName('');
      setPeriodicity('');
      setStartDate('');
      setSelectedEventIds([]);
      setEventSearchQuery('');
      setIsSavingElements(false);
    }
  }, [isOpen, editingPage]);

  if (!isOpen) return null;

  const addLinkField = () => {
    setLinks([...links, '']);
  };

  const updateLink = (index, value) => {
    const newLinks = [...links];
    newLinks[index] = value;
    setLinks(newLinks);
  };

  const removeLink = (index) => {
    const newLinks = links.filter((_, i) => i !== index);
    setLinks(newLinks);
  };

  const clearLink = (index) => {
    const newLinks = [...links];
    newLinks[index] = '';
    setLinks(newLinks);
  };

  const addElement = () => {
    if (newElementName.trim()) {
      setElements([...elements, { id: Date.now(), name: newElementName, parentId: null, children: [] }]);
      setNewElementName('');
    }
  };

  const clearNewElementName = () => {
    setNewElementName('');
  };

  const clearNewEventName = () => {
    setNewEventName('');
  };

  const addSubElement = (parentId) => {
    if (subElementName.trim()) {
      const addChild = (items) => {
        return items.map(item => {
          if (item.id === parentId) {
            return {
              ...item,
              children: [...item.children, { id: Date.now(), name: subElementName.trim(), parentId: parentId, children: [] }]
            };
          }
          if (item.children.length > 0) {
            return { ...item, children: addChild(item.children) };
          }
          return item;
        });
      };
      setElements(addChild(elements));
      setSubElementName('');
      setActiveSubInput(null);
    }
  };

  const deleteElement = (elementId) => {
    const deleteRecursive = (items) => {
      return items.filter(item => {
        if (item.id === elementId) return false;
        if (item.children.length > 0) {
          item.children = deleteRecursive(item.children);
        }
        return true;
      });
    };
    setElements(deleteRecursive(elements));
    if (activeSubInput === elementId) {
      setActiveSubInput(null);
    }
  };

  // Сохранение элементов в БД по одному
  const saveElementsToDatabase = async (pageId) => {
    if (elements.length === 0) return [];
    
    const savedElementsMap = new Map();
    const savedIds = [];
    
    const saveElementRecursive = async (element, parentRealId = null) => {
      let elementData;
      let numericPageId;
      
      try {
        numericPageId = typeof pageId === 'object' ? pageId.id : parseInt(pageId, 10);
        
        elementData = {
          name: element.name
        };
        
        if (parentRealId !== null && parentRealId !== undefined) {
          elementData.parent_id = parentRealId;
        }
        
        const response = await createElement(numericPageId, elementData);
        const savedElement = response.data;
        
        savedElementsMap.set(element.id, savedElement.id);
        savedIds.push(savedElement.id);
        
        for (const child of element.children) {
          await saveElementRecursive(child, savedElement.id);
        }
        
        return savedElement;
      } catch (error) {
        console.error('Ошибка сохранения элемента:', error.response?.data || error.message);
        throw error;
      }
    };
    
    try {
      for (const element of elements) {
        await saveElementRecursive(element, null);
      }
      
      return savedIds;
    } catch (error) {
      console.error('Ошибка сохранения элементов:', error);
      throw new Error('Не удалось сохранить элементы');
    }
  };

  // Обновление элементов при редактировании
  const updateElementsInDatabase = async (pageId) => {
    if (elements.length === 0) return [];
    
    const savedElementsMap = new Map();
    const savedIds = [];
    
    const saveElementRecursive = async (element, parentRealId = null) => {
      try {
        const numericPageId = typeof pageId === 'object' ? pageId.id : parseInt(pageId, 10);
        
        const elementData = {
          name: element.name
        };
        
        if (parentRealId !== null && parentRealId !== undefined) {
          elementData.parent_id = parentRealId;
        }
        
        const response = await createElement(numericPageId, elementData);
        const savedElement = response.data;
        
        savedElementsMap.set(element.id, savedElement.id);
        savedIds.push(savedElement.id);
        
        for (const child of element.children) {
          await saveElementRecursive(child, savedElement.id);
        }
        
        return savedElement;
      } catch (error) {
        console.error('Ошибка сохранения элемента:', error);
        throw error;
      }
    };
    
    try {
      for (const element of elements) {
        await saveElementRecursive(element, null);
      }
      
      return savedIds;
    } catch (error) {
      console.error('Ошибка обновления элементов:', error);
      throw new Error('Не удалось обновить элементы');
    }
  };

  const handleSavePageAndContinue = async () => {
    if (!selectedElementId) {
      alert('Выберите элемент');
      return;
    }
    
    setIsSavingElements(true);
    
    try {
      const validProjectId = projectId?.id || projectId;
      
      const pageForBackend = {
        title: pageTitle,
        links: links.filter(l => l.trim()).map(link => ({ url: link }))
      };
      
      const pageResponse = await onSavePage(validProjectId, pageForBackend);
      const savedPage = pageResponse.data || pageResponse;
      const pageId = savedPage.id;
      
      const savedElementIds = await saveElementsToDatabase(pageId);
      
      if (savedElementIds && savedElementIds.length > 0) {
        setSelectedElementId(savedElementIds[0]);
      }
      
      setStep(4);
    } catch (error) {
      console.error('Ошибка сохранения страницы и элементов:', error);
      alert('Не удалось сохранить страницу и элементы: ' + (error.response?.data?.message || error.message || 'Неизвестная ошибка'));
    } finally {
      setIsSavingElements(false);
    }
  };

  const handleUpdatePageAndContinue = async () => {
    if (!selectedElementId) {
      alert('Выберите элемент');
      return;
    }
    
    setIsSavingElements(true);
    
    try {
      const pageForBackend = {
        title: pageTitle,
        links: links.filter(l => l.trim()).map(link => ({ url: link }))
      };
      
      await onSavePage(editingPage.id, pageForBackend);
      
      // Удаляем старые элементы
      const existingElements = await getEventElements(editingPage.id);
      if (existingElements.data) {
        for (const elem of existingElements.data) {
          if (elem.id) {
            try {
              await deleteElement(elem.id);
            } catch (e) {
              console.error('Ошибка удаления элемента:', e);
            }
          }
        }
      }
      
      const savedElementIds = await updateElementsInDatabase(editingPage.id);
      
      if (savedElementIds && savedElementIds.length > 0) {
        setSelectedElementId(savedElementIds[0]);
      }
      
      setStep(4);
    } catch (error) {
      console.error('Ошибка обновления страницы и элементов:', error);
      alert('Не удалось обновить страницу и элементы: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsSavingElements(false);
    }
  };

  const handleNext = () => {
    if (step === 1 && pageTitle.trim() && links.some(l => l.trim())) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
    setActiveSubInput(null);
    setSubElementName('');
  };

  const handleClose = () => {
    const hasData = pageTitle.trim() || links.some(l => l.trim()) || elements.length > 0;
    if (hasData && step < 3 && !editingPage) {
      if (window.confirm('Вы уверены, что хотите закрыть? Данные не будут сохранены.')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) {
      alert('Введите название события');
      return;
    }
    
    if (eventType === 'regular') {
      if (!periodicity || !startDate) {
        alert('Заполните все поля для регулярного события');
        return;
      }
    }
    
    try {
      let eventData;
      if (eventType === 'regular') {
        eventData = {
          name: newEventName,
          event_type: 'regular',
          periodicity: periodicity,
          start_date: startDate,
          topic_id: null
        };
      } else {
        eventData = {
          name: newEventName,
          event_type: 'irregular',
          periodicity: null,
          start_date: null,
          topic_id: null
        };
      }
      
      const elementId = selectedElementId;
      if (!elementId) {
        alert('Элемент не выбран');
        return;
      }
      
      await createEvent({ event: eventData, element_ids: [elementId] });
      
      await fetchEvents();
      setNewEventName('');
      setPeriodicity('');
      setStartDate('');
    } catch (error) {
      console.error('Ошибка создания события:', error);
      alert('Не удалось создать событие');
    }
  };

  const toggleEventSelection = (eventId) => {
    setSelectedEventIds(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const handleSelectElement = (elementId) => {
    setSelectedElementId(elementId);
    if (editingPage) {
      loadElementEvents(elementId);
    }
  };

  const handleFinalSave = async () => {
    onClose(true);
  };

  const getAllElements = (items, level = 0) => {
    let result = [];
    items.forEach(item => {
      result.push({ id: item.id, name: item.name, level: level });
      if (item.children && item.children.length > 0) {
        result = [...result, ...getAllElements(item.children, level + 1)];
      }
    });
    return result;
  };

  const renderElements = (items, level = 0) => {
    return items.map((el) => (
      <div key={el.id} className={`${level > 0 ? 'ml-6' : ''} mb-2`}>
        <div className="flex items-center justify-between py-2">
          <span className="text-lg" style={{ color: colors.primary }}>
            {el.name}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubInput(activeSubInput === el.id ? null : el.id)}
              className="w-6 h-6 font-bold text-xl"
              style={{ color: colors.lightBlue }}
            >
              +
            </button>
            <button
              onClick={() => deleteElement(el.id)}
              className="w-6 h-6 font-bold text-lg"
              style={{ color: colors.error }}
            >
              ×
            </button>
          </div>
        </div>
        
        {activeSubInput === el.id && (
          <div className="flex gap-2 mt-1 ml-4 mb-2">
            <input
              type="text"
              value={subElementName}
              onChange={(e) => setSubElementName(e.target.value)}
              placeholder="Название подэлемента"
              className="flex-1 px-3 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-lg"
              style={{ borderColor: colors.lightGray }}
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && addSubElement(el.id)}
            />
            <button
              onClick={() => addSubElement(el.id)}
              className="px-3 py-1 rounded-lg transition-colors text-white text-lg"
              style={{ backgroundColor: colors.lightBlue }}
              onMouseEnter={(e) => e.target.style.backgroundColor = colors.primary}
              onMouseLeave={(e) => e.target.style.backgroundColor = colors.lightBlue}
            >
              Добавить
            </button>
          </div>
        )}
        
        {el.children.length > 0 && (
          <div className="ml-4 space-y-1 text-lg">
            {renderElements(el.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const allEvents = existingEvents;
  const filteredEvents = allEvents.filter(event =>
    event.name.toLowerCase().includes(eventSearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-[700px] max-h-[80vh] overflow-hidden flex flex-col shadow-xl relative" onClick={(e) => e.stopPropagation()}>
        
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors text-2xl z-10"
        >
          ×
        </button>

        <div className="px-6 py-6 text-center" style={{ borderColor: colors.lightGray }}>
          <h2 className="text-2xl font-semibold" style={{ color: colors.primary }}>
            {editingPage ? 'Редактирование страницы' : 'Добавление страницы'}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Шаг 1 */}
          {step === 1 && (
            <div>
              <div className="mb-4">
                <label className="block font-semibold mb-2 text-lg" style={{ color: colors.primary }}>
                  Введите название страницы:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={pageTitle}
                    onChange={(e) => setPageTitle(e.target.value)}
                    placeholder="Пример: Контакты"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
                    style={{ borderColor: colors.lightGray }}
                  />
                  {pageTitle && (
                    <button
                      onClick={() => setPageTitle('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label className="block font-semibold mb-2 text-lg" style={{ color: colors.primary }}>
                  Введите полную ссылку страницы:
                </label>
                {links.map((link, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={link}
                        onChange={(e) => updateLink(idx, e.target.value)}
                        placeholder="Пример: /service/schools"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
                        style={{ borderColor: colors.lightGray }}
                      />
                      {link && (
                        <button
                          onClick={() => clearLink(idx)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {links.length > 1 && (
                      <button
                        onClick={() => removeLink(idx)}
                        className="text-red-500 hover:text-red-700 px-3"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addLinkField}
                  className="text-lg mt-1 hover:underline"
                  style={{ color: colors.lightBlue }}
                >
                  + Добавить ещё ссылку
                </button>
              </div>
            </div>
          )}

          {/* Шаг 2 */}
          {step === 2 && (
            <div>
              <div className="mb-6">
                <label className="block text-xl font-semibold mb-4" style={{ color: colors.primary }}>
                  Добавьте содержание страницы:
                </label>
                
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={newElementName}
                      onChange={(e) => setNewElementName(e.target.value)}
                      placeholder="Название элемента (например: Направления)"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
                      style={{ borderColor: colors.lightGray }}
                      onKeyPress={(e) => e.key === 'Enter' && addElement()}
                    />
                    {newElementName && (
                      <button
                        onClick={clearNewElementName}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto border rounded-lg p-2" style={{ borderColor: colors.lightGray }}>
                  {elements.length === 0 ? (
                    <div className="text-center py-4" style={{ color: colors.secondaryText }}>
                      Нет элементов. Добавьте первый элемент выше.
                    </div>
                  ) : (
                    renderElements(elements)
                  )}
                </div>
                
                <button
                  onClick={addElement}
                  disabled={!newElementName.trim()}
                  className="w-full py-2 rounded-lg transition-colors text-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: colors.lightBlue }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = colors.primary}
                  onMouseLeave={(e) => e.target.style.backgroundColor = colors.lightBlue}
                >
                  Создать
                </button>
              </div>
            </div>
          )}

          {/* Шаг 3 */}
          {step === 3 && (
            <div>
              <div className="mb-4">
                <p className="text-lg mb-3" style={{ color: colors.primary }}>
                  Выберите элемент для привязки событий
                </p>
                
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
                  style={{ borderColor: colors.lightGray }}
                />
                
                <div className="max-h-[300px] overflow-y-auto border rounded-lg p-2" style={{ borderColor: colors.lightGray }}>
                  {elements.length === 0 ? (
                    <div className="text-center py-8" style={{ color: colors.secondaryText }}>
                      Нет элементов для выбора
                    </div>
                  ) : (() => {
                    const allElems = getAllElements(elements);
                    const filtered = searchQuery.trim() === '' 
                      ? allElems 
                      : allElems.filter(el => 
                          el.name.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                    
                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-8" style={{ color: colors.secondaryText }}>
                          Ничего не найдено
                        </div>
                      );
                    }
                    
                    return filtered.map((el) => (
                      <div
                        key={el.id}
                        onClick={() => handleSelectElement(el.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                          selectedElementId === el.id
                            ? 'text-white'
                            : 'hover:bg-gray-100'
                        }`}
                        style={{
                          marginLeft: `${el.level * 20}px`,
                          backgroundColor: selectedElementId === el.id ? colors.primary : undefined,
                          color: selectedElementId === el.id ? 'white' : colors.primary
                        }}
                      >
                        {el.name}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Шаг 4 */}
          {step === 4 && (
            <div>
              <div className="mb-4">
                <p className="text-lg font-semibold mb-3" style={{ color: colors.primary }}>
                  Создайте или выберите события для элемента:
                </p>
                
                <div className="border rounded-lg p-4 mb-4" style={{ borderColor: colors.lightGray }}>
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={newEventName}
                        onChange={(e) => setNewEventName(e.target.value)}
                        placeholder="Название события"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
                        style={{ borderColor: colors.lightGray }}
                      />
                      {newEventName && (
                        <button
                          onClick={clearNewEventName}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    
                    <button
                      onClick={handleCreateEvent}
                      className="px-4 py-2 rounded-lg transition-colors text-white"
                      style={{ backgroundColor: colors.lightBlue }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = colors.primary}
                      onMouseLeave={(e) => e.target.style.backgroundColor = colors.lightBlue}
                    >
                      +
                    </button>
                  </div>
                  
                  <div className="flex gap-4 mb-3">
                    <button
                      onClick={() => setEventType('irregular')}
                      className={`px-3 py-1 rounded-lg transition-colors text-sm ${
                        eventType === 'irregular'
                          ? 'text-white'
                          : 'border border-gray-300 text-gray-600'
                      }`}
                      style={{ backgroundColor: eventType === 'irregular' ? colors.primary : undefined }}
                    >
                      Н (нерегулярное)
                    </button>
                    <button
                      onClick={() => setEventType('regular')}
                      className={`px-3 py-1 rounded-lg transition-colors text-sm ${
                        eventType === 'regular'
                          ? 'text-white'
                          : 'border border-gray-300 text-gray-600'
                      }`}
                      style={{ backgroundColor: eventType === 'regular' ? colors.primary : undefined }}
                    >
                      Р (регулярное)
                    </button>
                  </div>
                  
                  {eventType === 'regular' && (
                    <div className="flex gap-2">
                      <select
                        value={periodicity}
                        onChange={(e) => setPeriodicity(e.target.value)}
                        className="px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 max-w-[140px]"
                        style={{ borderColor: colors.lightGray }}
                      >
                        <option value="">Как часто</option>
                        <option value="ежегодно">Ежегодно</option>
                        <option value="ежемесячно">Ежемесячно</option>
                        <option value="раз в квартал">Раз в квартал</option>
                        <option value="еженедельно">Еженедельно</option>
                      </select>
                      
                      <div className="relative">
                        <button
                          onClick={() => setShowDatePicker(!showDatePicker)}
                          className="px-3 py-1.5 border rounded-lg"
                          style={{ borderColor: colors.lightGray }}
                        >
                          📅
                        </button>
                        {showDatePicker && (
                          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-20">
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                              style={{ borderColor: colors.lightGray }}
                              autoFocus
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <input
                  type="text"
                  value={eventSearchQuery}
                  onChange={(e) => setEventSearchQuery(e.target.value)}
                  placeholder="Поиск событий..."
                  className="w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3"
                  style={{ borderColor: colors.lightGray }}
                />
                
                <div className="max-h-[200px] overflow-y-auto border rounded-lg" style={{ borderColor: colors.lightGray }}>
                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-4 text-sm" style={{ color: colors.secondaryText }}>
                      Нет событий. Создайте новое выше.
                    </div>
                  ) : (
                    filteredEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        style={{ borderColor: colors.lightGray }}
                        onClick={() => toggleEventSelection(event.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEventIds.includes(event.id)}
                          onChange={() => {}}
                          className="w-3.5 h-3.5"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="flex-1 text-sm" style={{ color: colors.primary }}>
                          {event.name}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: colors.lightGray, color: colors.secondaryText }}>
                          {event.event_type === 'regular' ? 'Регулярное' : 'Нерегулярное'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t" style={{ borderColor: colors.lightGray }}>
          <div className="flex items-center gap-3">
            {step > 1 && step !== 4 && (
              <button
                onClick={handleBack}
                className="px-6 py-2 rounded-lg transition-colors border"
                style={{ borderColor: colors.lightGray, color: colors.primary }}
              >
                Назад
              </button>
            )}
            
            {step === 4 && (
              <button
                onClick={handleBack}
                className="px-6 py-2 rounded-lg transition-colors border"
                style={{ borderColor: colors.lightGray, color: colors.primary }}
              >
                Назад
              </button>
            )}
            
            <div className="flex-1"></div>
            
            <div className="flex items-center gap-4">
              {step === 3 && (
                <button
                  onClick={editingPage ? handleUpdatePageAndContinue : handleSavePageAndContinue}
                  disabled={!selectedElementId || isSavingElements}
                  className="px-6 py-2 rounded-lg transition-colors text-white text-base disabled:bg-gray-400 disabled:cursor-not-allowed"
                  style={{ backgroundColor: colors.lightBlue }}
                  onMouseEnter={(e) => {
                    if (selectedElementId && !isSavingElements) {
                      e.target.style.backgroundColor = colors.primary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = colors.lightBlue;
                  }}
                >
                  {isSavingElements ? 'Сохранение...' : (editingPage ? 'Обновить и продолжить' : 'Сохранить и продолжить')}
                </button>
              )}
              
              {step === 4 && (
                <button
                  onClick={handleFinalSave}
                  className="px-6 py-2 rounded-lg transition-colors text-white text-base"
                  style={{ backgroundColor: colors.lightBlue }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = colors.primary}
                  onMouseLeave={(e) => e.target.style.backgroundColor = colors.lightBlue}
                >
                  {editingPage ? 'Сохранить изменения' : 'Готово'}
                </button>
              )}
              
              {step !== 3 && step !== 4 && (
                <button
                  onClick={handleNext}
                  disabled={step === 1 && (!pageTitle.trim() || !links.some(l => l.trim()))}
                  className="px-6 py-2 rounded-lg transition-colors text-white text-xl disabled:bg-gray-400 disabled:cursor-not-allowed"
                  style={{ backgroundColor: colors.lightBlue }}
                  onMouseEnter={(e) => {
                    if (!(step === 1 && (!pageTitle.trim() || !links.some(l => l.trim())))) {
                      e.target.style.backgroundColor = colors.primary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = colors.lightBlue;
                  }}
                >
                  Далее
                </button>
              )}
              
              <span className="text-2xl" style={{ color: colors.secondaryText }}>
                {step}/4
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddPageModal;