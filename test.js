const express = require('express');
const net = require('net');
const httpApp = express();
const httpPort = 3000; // Порт для HTTP-соединений

httpApp.use(express.static('public'));

// Порт и хост для TCP-соединений, как в вашем исходном коде
const TCP_PORT = 7108;
const TCP_HOST = '0.0.0.0';

let tcpSocket = null; // Для хранения сокета TCP-клиента

// Создаем TCP-сервер
const tcpServer = net.createServer((socket) => {
    console.log(`Ридер подключен с адреса: ${socket.remoteAddress}`);
    tcpSocket = socket; // Сохраняем сокет для последующего использования
    const initialCommand = Buffer.from([0x55, 0xAA, 0x55, 0x00, 0x25, 0x80, 0x03, 0xA8]);
    socket.write(initialCommand, () => {
        console.log('Инициализирующая команда отправлена клиенту');
    });
    socket.on('data', (data) => {
        console.log(`Получены данные: ${data.toString('hex')}`);
        //Полученный пример данных FF 00 06 83 02 02 B3 7B 06 C1 [Tag Serial:0x 02 B3 7B 06][UID Length:4][Tag Type:0x02]
        // Предполагаем, что UID начинается с 5-го байта и занимает 4 байта
        const uid = data.slice(5, 9).toString('hex').toUpperCase();
        console.log(`Извлеченный UID карты: ${uid}`);
        // Здесь вы можете добавить дополнительную логику обработки UID
    });

    socket.on('close', () => {
        console.log('Ридер отключен');
        tcpSocket = null; // Очищаем ссылку на сокет при его закрытии
    });
});

tcpServer.listen(TCP_PORT, TCP_HOST, () => {
    console.log(`TCP Сервер слушает ${TCP_HOST}:${TCP_PORT}`);
});

// Настройка HTTP-сервера на Express для обработки GET-запросов
httpApp.get('/open-door', (req, res) => {
    if (tcpSocket) {
        const command = Buffer.from([0xFF, 0x00, 0x08, 0xD0, 0x09, 0x02, 0x00, 0x32, 0x00, 0x32, 0x00, 0x47]);
        tcpSocket.write(command, () => {
            res.send('Команда "Activate All" отправлена');
        });
    } else {
        res.status(404).send('TCP клиент не подключен');
    }
});

httpApp.get('/reset', (req, res) => {
    if (tcpSocket) {
        const command = Buffer.from([0xFF, 0x00, 0x01, 0x80, 0x81]);
        tcpSocket.write(command, () => {
            res.send('Команда "Reset" отправлена');
        });
    } else {
        res.status(404).send('TCP клиент не подключен');
    }
});

// Запуск HTTP-сервера
httpApp.listen(httpPort, () => {
    console.log(`HTTP Сервер запущен на порту ${httpPort}`);
});
