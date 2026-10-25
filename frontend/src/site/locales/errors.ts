import type { TranslationCatalog } from '../i18n-core'

export const errors: TranslationCatalog = {
  'Дождись завершения текущего входа или выхода.': {
    kk: 'Ағымдағы кіру немесе шығу әрекетінің аяқталуын күт.',
    en: 'Wait for the current sign-in or sign-out to finish.',
  },
  'Вход отменён': { kk: 'Жүйеге кіруден бас тартылды', en: 'Sign-in cancelled' },
  'Запрос отменён': { kk: 'Сұраудан бас тартылды', en: 'Request cancelled' },

  'Нет такого метода API': { kk: 'Мұндай API әдісі жоқ', en: 'This API endpoint does not exist' },
  'Некорректный JSON': { kk: 'JSON пішімі дұрыс емес', en: 'Invalid JSON' },
  'Некорректный email': { kk: 'Электрондық пошта мекенжайы дұрыс емес', en: 'Invalid email address' },
  'Введи пароль': { kk: 'Құпиясөзді енгіз', en: 'Enter your password' },
  'Название — минимум 2 символа': { kk: 'Атауы кемінде 2 таңбадан тұруы керек', en: 'The title must have at least 2 characters' },
  'Описание — минимум 10 символов': { kk: 'Сипаттама кемінде 10 таңбадан тұруы керек', en: 'The description must have at least 10 characters' },
  'Выбери поддерживаемый город': { kk: 'Қолжетімді қалалардың бірін таңда', en: 'Choose a supported city' },
  'Дата — в формате ГГГГ-ММ-ДД': { kk: 'Күнді ЖЖЖЖ-АА-КК пішімінде көрсет', en: 'Enter the date in YYYY-MM-DD format' },
  'Укажи существующую календарную дату': { kk: 'Күнтізбедегі жарамды күнді көрсет', en: 'Enter a valid calendar date' },
  'Время — в формате ЧЧ:ММ–ЧЧ:ММ': { kk: 'Уақытты СС:ММ–СС:ММ пішімінде көрсет', en: 'Enter the time in HH:MM–HH:MM format' },
  'Время окончания должно быть позже начала': { kk: 'Аяқталу уақыты басталу уақытынан кейін болуы керек', en: 'The end time must be after the start time' },
  'Укажи дату, время, место и точку события на карте': { kk: 'Іс-шараның күнін, уақытын, орнын және картадағы нүктесін көрсет', en: 'Enter the event date, time, venue and a point on the map' },
  'Некорректный ключ повторного запроса': { kk: 'Қайталама сұрау кілті дұрыс емес', en: 'Invalid retry request key' },
  'Удалять можно только свои публикации': { kk: 'Тек өз жарияланымдарыңды өшіруге болады', en: 'You can only delete your own publications' },
  'Напиши сообщение автору': { kk: 'Авторға хабарлама жаз', en: 'Write a message to the author' },
  'Ссылка на портфолио должна начинаться с http(s)://': { kk: 'Портфолио сілтемесі http:// немесе https:// арқылы басталуы керек', en: 'The portfolio URL must start with http:// or https://' },

  'Этот ключ уже использован для другой публикации. Сохрани черновик и повтори с новым ключом.': {
    kk: 'Бұл кілт басқа жарияланым үшін пайдаланылған. Нобайды сақтап, жаңа кілтпен қайталап көр.',
    en: 'This key has already been used for another publication. Save a draft and try again with a new key.',
  },
  'Публикация по этому запросу уже удалена. Повтор запроса не создаёт её заново.': {
    kk: 'Осы сұрау арқылы жасалған жарияланым өшірілген. Сұрауды қайталау оны қайта жасамайды.',
    en: 'The publication created by this request has been deleted. Retrying the request will not recreate it.',
  },

}
