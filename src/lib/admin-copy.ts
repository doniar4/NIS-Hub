import type {Locale} from "./i18n";
const copy={
 records:["Записи","Жазбалар","Records"],create:["Создать запись","Жазба жасау","Create record"],edit:["Редактировать запись","Жазбаны өзгерту","Edit record"],new:["Новая запись","Жаңа жазба","New record"],save:["Сохранить","Сақтау","Save"],classes:["Классы","Сыныптар","Classes"],subjects:["Предметы","Пәндер","Subjects"],
 limit:["Показано до 200 книг (по названию).","Атауы бойынша 200 кітапқа дейін көрсетілген.","Showing up to 200 books, sorted by title."],
 className:["Название класса","Сынып атауы","Class name"],grade:["Параллель (1–12)","Сынып деңгейі (1–12)","Grade (1–12)"],section:["Буква / секция","Әріп / бөлім","Letter / section"],
 subjectName:["Название предмета (RU)","Пән атауы (RU)","Subject name (RU)"],kazakh:["Название на казахском","Қазақша атауы","Kazakh name"],english:["Название на английском","Ағылшынша атауы","English name"],short:["Краткое название","Қысқаша атауы","Short name"],
 archive:["Переместить в архив","Мұрағаттау","Archive"],archiveHint:["Книга исчезнет из библиотеки. Файл и закладки сохранятся; публикацию можно восстановить.","Кітап кітапханадан жасырылады. Файл мен бетбелгілер сақталады; жариялауды қалпына келтіруге болады.","The book leaves the Library. Its file and bookmarks remain; publishing can be restored."],
 deleteHint:["Используемые классы и предметы удалить нельзя. Удаление справочной записи необратимо.","Қолданылып тұрған сыныптар мен пәндерді жоюға болмайды. Анықтамалық жазбаны жою қайтарылмайды.","Referenced classes and subjects cannot be deleted. Catalog record deletion is irreversible."],
 lessonDelete:["Удаление урока создаст новую версию. Прежнее расписание можно восстановить в истории версий.","Сабақты жою жаңа нұсқа жасайды. Бұрынғы кестені нұсқалар тарихынан қалпына келтіруге болады.","Deleting a lesson creates a new version. The earlier timetable can be restored from version history."],
} as const;
export const adminCopy=(locale:Locale)=>Object.fromEntries(Object.entries(copy).map(([key,values])=>[key,values[locale==="ru"?0:locale==="kk"?1:2]])) as Record<keyof typeof copy,string>;
