// pjax适配
document.addEventListener("DOMContentLoaded", () => {
    cardTimes();
    cardRefreshTimes();
}); //第一次加载

document.addEventListener("pjax:complete", () => {
    cardTimes();
    cardRefreshTimes();
}) // pjax加载完成（切换页面）后再执行一次

var now = new Date();
var year, month, week, date, dates, weekStr, monthStr;
var asideTime, asideDay, asideDayNum;
var animalYear, ganzhiYear, lunarMon, lunarDay;

// 刷新时钟时间
function cardRefreshTimes() {
    var cardWidgetSchedule = document.getElementById("card-widget-schedule");
    if (cardWidgetSchedule) {
        asideDay = (now - asideTime) / 1e3 / 60 / 60 / 24;
        cardWidgetSchedule.querySelector("#pBar_year").value = asideDay;
        cardWidgetSchedule.querySelector("#p_span_year").innerHTML = (asideDay / 365 * 100).toFixed(2) + "%";
        cardWidgetSchedule.querySelector(".schedule-r0 .schedule-d1 .aside-span2").innerHTML = "还剩<a> " + (365 - asideDay).toFixed(0) + " </a>天";
        cardWidgetSchedule.querySelector("#pBar_month").value = date;
        cardWidgetSchedule.querySelector("#pBar_month").max = dates;
        cardWidgetSchedule.querySelector("#p_span_month").innerHTML = (date / dates * 100).toFixed(2) + "%";
        cardWidgetSchedule.querySelector(".schedule-r1 .schedule-d1 .aside-span2").innerHTML = "还剩<a> " + (dates - date) + " </a>天";
        cardWidgetSchedule.querySelector("#pBar_week").value = week == 0 ? 7 : week;
        cardWidgetSchedule.querySelector("#p_span_week").innerHTML = ((week == 0 ? 7 : week) / 7 * 100).toFixed(2) + "%";
        cardWidgetSchedule.querySelector(".schedule-r2 .schedule-d1 .aside-span2").innerHTML = "还剩<a> " + (7 - (week == 0 ? 7 : week)) + " </a>天";
    }
}
// 侧边栏日历卡片
function cardTimes() {
    year = now.getFullYear();
    month = now.getMonth();
    week = now.getDay();
    date = now.getDate();
    var cardWidgetCalendar = document.getElementById("card-widget-calendar");
    if (cardWidgetCalendar) {
        var year_flag = year % 4 == 0 && year % 100 != 0 || year % 400 == 0 ? true : false;
        switch (week) {
            case 0: weekStr = "周日"; break;
            case 1: weekStr = "周一"; break;
            case 2: weekStr = "周二"; break;
            case 3: weekStr = "周三"; break;
            case 4: weekStr = "周四"; break;
            case 5: weekStr = "周五"; break;
            case 6: weekStr = "周六"; break;
            default: console.log("异常情况");
        }
        switch (month) {
            case 0: monthStr = "1月"; dates = 31; break;
            case 1: monthStr = "2月"; dates = year_flag ? 29 : 28; break;
            case 2: monthStr = "3月"; dates = 31; break;
            case 3: monthStr = "4月"; dates = 30; break;
            case 4: monthStr = "5月"; dates = 31; break;
            case 5: monthStr = "6月"; dates = 30; break;
            case 6: monthStr = "7月"; dates = 31; break;
            case 7: monthStr = "8月"; dates = 31; break;
            case 8: monthStr = "9月"; dates = 30; break;
            case 9: monthStr = "10月"; dates = 31; break;
            case 10: monthStr = "11月"; dates = 30; break;
            case 11: monthStr = "12月"; dates = 31; break;
            default: console.log("异常情况");
        }
        var week_first = (week + 8 - date % 7) % 7;
        var count_days = "";
        var count_flag = false;
        var ds;
        var row_h = 7 - week_first; //第一行天数
        var row_f = (dates - row_h) % 7; //最后一行的天数
        var rows = row_f == 0 ? Math.floor((dates - row_h) / 7) + 1 : Math.floor((dates - row_h) / 7) + 2;
        var calendar = cardWidgetCalendar.querySelector("#calendar-main");
        var gap = cardWidgetCalendar.querySelector("#calendar-date");
        switch (rows) {
            case 4: gap.style.fontSize = "36px"; break;
            case 5: gap.style.fontSize = "48px"; break;
            case 6: gap.style.fontSize = "64px"; break;
            default: gap.style.fontSize = "64px";
        }
        for (let r = 0; r < rows; r++) {
            if (calendar.querySelector(".calendar-r" + r) == null) {
                calendar.innerHTML += "<div class='calendar-r" + r + "'></div>";
            }
            for (let d = 0; d < 7; d++) {
                if (r == 0 && d == week_first) { //本月第一天
                    count_days = 1;
                    count_flag = true;
                }
                if (count_days == date) { //当日日期
                    ds = " class='now'";
                } else ds = "";
                if (calendar.querySelector(".calendar-r" + r + " .calendar-d" + d + " a") == null) {
                    calendar.querySelector(".calendar-r" + r).innerHTML += "<div class='calendar-d" + d + "'><a" + ds + ">" + count_days + "</a></div>";
                }
                if (count_days >= dates) {
                    count_days = "";
                    count_flag = false;
                }
                if (count_flag) count_days += 1;
            }
        }
        var lunar = chineseLunar.solarToLunar(new Date(year, month, date));
        animalYear = chineseLunar.format(lunar, "A"); //生肖属相
        ganzhiYear = chineseLunar.format(lunar, "T").slice(0, -1); //天干地支
        lunarMon = chineseLunar.format(lunar, "M"); //月份
        lunarDay = chineseLunar.format(lunar, "d"); //日期
        var anniversary = new Date("2024/12/20 08:30:00");
        var countDown = Math.floor((anniversary - now) / 1e3 / 60 / 60 / 24);
        asideTime = new Date(new Date().getFullYear() + "/01/01 00:00:00");	// 侧边栏倒计时
        asideDay = (now - asideTime) / 1e3 / 60 / 60 / 24;
        asideDayNum = Math.floor(asideDay);
        var asideWeekNum = ((week - asideDayNum % 7) >= 0) ? (Math.ceil(asideDayNum / 7)) : (Math.ceil(asideDayNum / 7) + 1);
        cardWidgetCalendar.querySelector("#calendar-week").innerHTML = "第" + asideWeekNum + "周&nbsp;" + weekStr; //星期
        cardWidgetCalendar.querySelector("#calendar-date").innerHTML = date.toString().padStart(2, '0'); //日期
        cardWidgetCalendar.querySelector("#calendar-solar").innerHTML = year + "年" + monthStr + "&nbsp;第" + asideDay.toFixed(0) + "天"; //年份
        cardWidgetCalendar.querySelector("#calendar-lunar").innerHTML = ganzhiYear + animalYear + "年&nbsp;" + lunarMon + lunarDay; //农历
        document.getElementById("schedule-days").innerHTML = countDown; //农历
    }
}