const startTime = new Date('12/09/2024 21:35:00');
const workboardElement = document.getElementById("workboard");

function formatTime(value) {
    return value.toString().padStart(2, '0');
}

function calculateTravelerDistance(milliseconds) {
    return Math.trunc(234e8 + milliseconds / 1e3 * 17);
}

function calculateAstronomicalUnits(distance) {
    return (distance / 1496e5).toFixed(6);
}

function updateWorkboard() {
    const now = new Date();
    const elapsedMilliseconds = now - startTime;
    const days = Math.floor(elapsedMilliseconds / (1000 * 60 * 60 * 24));
    const hours = formatTime(Math.floor((elapsedMilliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
    const minutes = formatTime(Math.floor((elapsedMilliseconds % (1000 * 60 * 60)) / (1000 * 60)));
    const seconds = formatTime(Math.floor((elapsedMilliseconds % (1000 * 60)) / 1000));

    const distance = calculateTravelerDistance(elapsedMilliseconds);
    const au = calculateAstronomicalUnits(distance);

    // Simplified content without the badge image and its title
    const content = `
        <div style="font-size:13px;font-weight:bold">
            本站居然运行了 ${days} 天 ${hours} 小时 ${minutes} 分 ${seconds} 秒 <i id="heartbeat" class='fas fa-heartbeat'></i><br>
            旅行者 1 号当前距离地球 ${distance} 千米，约为 ${au} 个天文单位 🚀
        </div>`;

    if (workboardElement) {
        workboardElement.innerHTML = content;
    }
}

// Update the workboard every second
setInterval(updateWorkboard, 1000);