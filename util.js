

function formatDate(dateString) {
    var date = new Date(dateString);
    var year = date.getFullYear();
    var month = ('0' + (date.getMonth() + 1)).slice(-2);
    var day = ('0' + date.getDate()).slice(-2);
    return year + '-' + month + '-' + day;
}

function isDatePastTwoMonth(dateString) {
    const inputDate = new Date(dateString); 
    const today = new Date();
    const dateLine = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate());

    inputDate.setHours(0, 0, 0, 0);
    dateLine.setHours(0, 0, 0, 0);

    return inputDate < dateLine; 
}

function isDatePastOneMonth(dateString) {
    const inputDate = new Date(dateString); 
    const today = new Date();
    const dateLine = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

    inputDate.setHours(0, 0, 0, 0);
    dateLine.setHours(0, 0, 0, 0);

    return inputDate < dateLine; 
}

function isDatePastTwoWeek(dateString) {
    const inputDate = new Date(dateString); 
    const today = new Date();
    const dateLine = new Date(today.getFullYear(), today.getMonth(), today.getDate()+20);

    inputDate.setHours(0, 0, 0, 0);
    dateLine.setHours(0, 0, 0, 0);

    return inputDate < dateLine; 
}

function isDatePast(dateString) {
    const inputDate = new Date(dateString); 
    const today = new Date();
    const dateLine = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    inputDate.setHours(0, 0, 0, 0);
    dateLine.setHours(0, 0, 0, 0);

    return inputDate < dateLine; 
}
function formatDateString(dateString) {
    // 날짜 문자열을 Date 객체로 변환
    const date = new Date(dateString);
    
    // 년, 월, 일, 시간, 분 추출
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // 월은 0부터 시작하므로 +1 필요
    const day = String(date.getDate()).padStart(2, '0');
    
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // 오후/오전 설정 및 12시간제로 변환
    const period = hours >= 12 ? '오후' : '오전';
    hours = hours % 12 || 12; // 0시를 12시로 변환
    
    // 포맷팅된 문자열 반환
    return `${year}-${month}-${day} (${period}) ${hours}시 ${minutes}분`;
  }

  function findTime(dateString) {
    const date = new Date(dateString);
    const hours = String(date.getHours()).padStart(2, '0'); // 시간은 두 자리로 포맷
    const minutes = String(date.getMinutes()).padStart(2, '0'); // 분은 두 자리로 포맷
    return `${hours}:${minutes}`;
  }

module.exports = {
  formatDate,
  isDatePastTwoMonth,
  isDatePastOneMonth,
  isDatePastTwoWeek,
  formatDateString,
  findTime,
  isDatePast,
};