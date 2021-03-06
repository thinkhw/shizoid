const {config} = require('../config/config.js');
const models = require('../models');
const _ = require('lodash');
const Message = require('./message.js');
const request = require('request');
const path = require('path');

const eightballAnswer = ['Бесспорно.',
    'Предрешено.',
    'Никаких сомнений.',
    'Определённо да.',
    'Можешь быть уверен в этом.',
    'Мне кажется — «да»',
    'Вероятнее всего.',
    'Хорошие перспективы.',
    'Знаки говорят — «да».',
    'Да.',
    'Пока не ясно.',
    'Cпроси завтра.',
    'Лучше не рассказывать.',
    'Сегодня нельзя предсказать.',
    'Сконцентрируйся и спроси опять.',
    'Даже не думай.',
    'Мой ответ — «нет».',
    'По моим данным — «нет».',
    'Перспективы не очень хорошие.',
    'Весьма сомнительно.'];

function CommandParser(bot) {
    this.bot = bot;
}

CommandParser.prototype.isCommand = function (msg) {
    return msg.entities && _.size(_.find(msg.entities, {type: 'bot_command', offset: 0}));
};

CommandParser.prototype.process = function (msg) {
    let commandEntity = _.find(msg.entities, {type: 'bot_command', offset: 0});
    let command = msg.text.substr(commandEntity.offset, commandEntity.length);
    msg.text = msg.text.substr(commandEntity.length + 1);
    msg.entities = _.filter(msg.entities, (entity) => {
        return entity.type !== 'bot_command'
    });

    if (_.includes(command, 'isCommand') || _.includes(command, 'process')) {
        return;
    }

    if (msg.chat.type === 'supergroup' || msg.chat.type === 'group') {
        if (!_.includes(command, this.bot.me.username)) {
            return;
        }
    }

    command = _.trim(command.split('@')[0].substr(1));

    if (this[command]) {
        this[command](msg);
    }
};

CommandParser.prototype.ping = function (msg) {
    this.bot.sendMessage(msg.chat.id, 'Pong!', {
        reply_to_message_id: msg.message_id
    });
};

CommandParser.prototype.get_gab = async function (msg) {
    let self = this;
    let chat = await models.Chat.getChat(msg);

    self.bot.sendMessage(msg.chat.id, chat.get('random_chance'), {
        reply_to_message_id: msg.message_id
    });
};

CommandParser.prototype.set_gab = async function (msg) {
    let self = this;
    let chance = parseInt(msg.text) || 0;
    if ((msg.chat.type === 'supergroup' || msg.chat.type === 'group') && msg.from.id !== 36586950) {
        let admins = await this.bot.getChatAdministrators(msg.chat.id);
        let user = _.find(admins, function (admin) {
            return admin.user.id === msg.from.id
        });

        console.log(admins);

        if (!user) {
            return self.bot.sendMessage(msg.chat.id, 'Not allowed', {
                reply_to_message_id: msg.message_id
            });
        }
    }

    let chat = await models.Chat.getChat(msg);
    chat.set('random_chance', chance);
    chat.save();
    self.bot.sendMessage(msg.chat.id, 'Setting gab to ' + chance, {
        reply_to_message_id: msg.message_id
    });
};

CommandParser.prototype.get_pairs = async function (msg) {
    let chat = await models.Chat.getChat(msg);
    let counter = await models.Pair.count({where: {ChatId: chat.get('id')}});

    this.bot.sendMessage(msg.chat.id, 'Known pairs for this chat ' + counter, {
        reply_to_message_id: msg.message_id
    });
};

CommandParser.prototype.eightball = async function (msg) {
    let mm = new Message(this.bot, msg);
    this.bot.sendChatAction(msg.chat.id, 'typing');
    let additionalAnswer = await mm.generateAnswer();
    mm.reply(_.sample(eightballAnswer) + ' ' + additionalAnswer.join(' '));
};

CommandParser.prototype.leaveAll = async function (msg) {
    if (msg.from.id !== 36586950) {
        return;
    }

    let chats = await models.Chat.findAll();
    _.each(chats, (chat) => {
        if(chat.get('chat_type') === 'supergroup' || chat.get('chat_type') === 'group')
        this.bot.leaveChat(chat.get('telegram_id'));
    });
};

CommandParser.prototype.banUser = async function (msg) {
    if (msg.from.id !== 36586950) {
        return;
    }

    let userId = msg.text;
    let user = await models.User.getUser(userId);
    user.set('banned', !user.get('banned'));
    user.save();
    this.bot.sendMessage(msg.chat.id, 'Banned' + msg.text);
};

CommandParser.prototype.meow = async function (msg) {
    let self = this;
    request({
        url: 'http://thecatapi.com/api/images/get?format=src&type=gif',
        followAllRedirects: true
    }, function (err, res, body) {
        if (err) {
            console.log(err);
            return this.bot.sendMessage(msg.chat.id, 'Котики не идут');
        }

        let imageUrl = res.request.uri.href;
        let file = request(imageUrl);
        self.bot.sendChatAction(msg.chat.id, 'upload_video');
        self.bot.sendVideo(msg.chat.id, file);
    });
};

module.exports = CommandParser;
