// Github:   https://github.com/shdwjk/Roll20API/blob/master/GroupInitiative/GroupInitiative.js
// By:       The Aaron, Arcane Scriptomancer
// Contact:  https://app.roll20.net/users/104025/the-aaron

var GroupInitiative = GroupInitiative || (function() {
    'use strict';

    var version = '0.9.11',
        lastUpdate = 1443613435,
        schemaVersion = 1.0,
        bonusCache = {},
        observers = {
                turnOrderChange: []
			},
        sorters = {
            'None': function(to) {
                return to;
            },
            'Ascending': function(to){
                return _.sortBy(to,function(i){
                    return (i.pr);
                });
            },
            'Descending': function(to){
                return _.sortBy(to,function(i){
                    return (-i.pr);
                });
            }
        },
        esRE = function (s) {
          var escapeForRegexp = /(\\|\/|\[|\]|\(|\)|\{|\}|\?|\+|\*|\||\.|\^|\$)/g;
          return s.replace(escapeForRegexp,"\\$1");
        },

        HE = (function(){
          var entities={
                  //' ' : '&'+'nbsp'+';',
                  '<' : '&'+'lt'+';',
                  '>' : '&'+'gt'+';',
                  "'" : '&'+'#39'+';',
                  '@' : '&'+'#64'+';',
                  '{' : '&'+'#123'+';',
                  '|' : '&'+'#124'+';',
                  '}' : '&'+'#125'+';',
                  '[' : '&'+'#91'+';',
                  ']' : '&'+'#93'+';',
                  '"' : '&'+'quot'+';'
              },
              re=new RegExp('('+_.map(_.keys(entities),esRE).join('|')+')','g');
          return function(s){
            return s.replace(re, function(c){ return entities[c] || c; });
          };
        }()),

		observeTurnOrderChange = function(handler){
			if(handler && _.isFunction(handler)){
				observers.turnOrderChange.push(handler);
			}
		},
		notifyObservers = function(event){
			_.each(observers[event],function(handler){
				handler();
			});
		},

        formatDieRoll = function(rollData) {
            var critFail = _.reduce(rollData.rolls,function(m,r){
                        return m || _.contains(r.rolls,1);
                    },false),
                critSuccess = _.reduce(rollData.rolls,function(m,r){
                        return m || _.contains(r.rolls,r.sides);
                    },false),
                highlight = ( (critFail && critSuccess)
                    ? '#4A57ED'
                    : ( critFail
                        ? '#B31515' 
                        : ( critSuccess
                            ? '#3FB315'
                            : '#FEF68E'
                        )
                    )
                ),
                dicePart = _.reduce(rollData.rolls, function(m,r){
                    _.reduce(r.rolls,function(dm,dr){
                        var dielight=( 1 === dr
                                ? '#ff0000' 
                                : ( r.sides === dr
                                    ? '#00ff00'
                                    : 'white'
                                )
                            );
                        dm.push('<span style="font-weight:bold;color:'+dielight+';">'+dr+'</span>');
                        return dm;
                    },m);
                    return m;
                },[]).join(' + ');

            return '<span class="inlinerollresult showtip tipsy" style="min-width:1em;display: inline-block; border: 2px solid '+
                highlight+
                '; background-color: #FEF68E;color: #404040; font-weight:bold;padding: 0px 3px;cursor: help"'+
                ' title="'+
                HE(HE(
                    '<span style="color:white;">'+
                        dicePart+' [init] '+
                        (rollData.bonus>=0 ? '+' :'-')+' <span style="font-weight:bold;">'+Math.abs(rollData.bonus)+'</span> [bonus]'+
                    '</span>'
                ))+'">'+
                    rollData.total+
                '</span>';
        },

        buildAnnounceGroups = function(l) {
            var groupColors = {
                npc: '#eef',
                character: '#efe',
                gmlayer: '#aaa'
            };
            return _.reduce(l,function(m,s){
                var type= ('gmlayer' === s.token.get('layer') 
                    ? 'gmlayer' 
                    : ( (s.character && _.filter(s.character.get('controlledby').split(/,/),function(c){ 
                            return 'all' === c || ('' !== c && !playerIsGM(c) );
                        }).length>0) || false 
                        ? 'character'
                        : 'npc'
                    ));
                if('graphic'!==s.token.get('type') || 'token' !==s.token.get('subtype')) {
                    return m;
                }
                m[type].push('<div style="float: left;display: inline-block;border: 1px solid #888;border-radius:5px; padding: 1px 3px;background-color:'+groupColors[type]+';">'+
                    '<div style="font-weight:bold; font-size: 1.3em;">'+
                        '<img src="'+(s.token && s.token.get('imgsrc'))+'" style="height: 2.5em;float:left;margin-right:2px;">'+
                        ((s.token && s.token.get('name')) || (s.character && s.character.get('name')) || '(Creature)')+
                    '</div>'+
                    '<div>'+
                        formatDieRoll(s.rollResults)+
                    '</div>'+
                    '<div style="clear: both;"></div>'+
                '</div>');
                return m;
            },{npc:[],character:[],gmlayer:[]});
        },

        announcers = {
            'None': function() {
            },
            'Hidden': function(l) {
                var groups=buildAnnounceGroups(l);
                sendChat('GroupInit','/w gm '+
                    '<div>'+
                        groups.character.join('')+
                        groups.npc.join('')+
                        groups.gmlayer.join('')+
                        '<div style="clear:both;"></div>'+
                    '</div>');
            },
            'Partial': function(l) {
                var groups=buildAnnounceGroups(l);
                sendChat('GroupInit','/direct '+
                    '<div>'+
                        groups.character.join('')+
                        '<div style="clear:both;"></div>'+
                    '</div>');
                sendChat('GroupInit','/w gm '+
                    '<div>'+
                        groups.npc.join('')+
                        groups.gmlayer.join('')+
                        '<div style="clear:both;"></div>'+
                    '</div>');
            },
            'Visible': function(l) {
                var groups=buildAnnounceGroups(l);
                sendChat('GroupInit','/direct '+
                    '<div>'+
                        groups.character.join('')+
                        groups.npc.join('')+
                        '<div style="clear:both;"></div>'+
                    '</div>');
                sendChat('GroupInit','/w gm '+
                    '<div>'+
                        groups.gmlayer.join('')+
                        '<div style="clear:both;"></div>'+
                    '</div>');
            }
        },

        statAdjustments = {
            'Stat-DnD': {
                func: function(v) {
                    return 'floor((('+v+')-10)/2)';
                },
                desc: 'Calculates the bonus as if the value were a DnD Stat.'
            },
            'Bare': {
                func: function(v) {
                    return v;
                },
                desc: 'No Adjustment.'
            },
            'Floor': {
                func: function(v) {
                    return 'floor('+v+')';
                },
                desc: 'Rounds down to the nearest integer.'
            },
            'Tie-Breaker': {
                func: function(v) {
                    return '(0.01*('+v+'))';
                },
                desc: 'Adds the accompanying attribute as a decimal (0.01)'
            },
            'Ceiling': {
                func: function(v) {
                    return 'ceil('+v+')';
                },
                desc: 'Rounds up to the nearest integer.'
            },
            'Bounded': {
                func: function(v) {
                    return v;
                },
                desc: '<b>DEPREICATED - will not work with expresions.</b>'
            }
        },

        buildInitDiceExpression = function(s){
            var stat=(''!== state.GroupInitiative.config.diceCountAttribute && s.character && getAttrByName(s.character.id, state.GroupInitiative.config.diceCountAttribute, 'current'));
            if(stat ) {
                stat = (_.isString(stat) ? stat : stat+'');
                if('0' !== stat) {
                    stat = stat.replace(/@\{([^\|]*?|[^\|]*?\|max|[^\|]*?\|current)\}/g, '@{'+(s.character.get('name'))+'|$1}');
                    return '('+stat+')d'+state.GroupInitiative.config.dieSize;
                }
            } 
            return state.GroupInitiative.config.diceCount+'d'+state.GroupInitiative.config.dieSize;
        },

        rollers = {
            'Least-All-Roll':{
                mutator: function(l){
                    var min=_.reduce(l,function(m,r){
                        if(!m || (r.total < m.total)) {
                            return r;
                        } 
                        return m;
                    },false);
                    return _.times(l.length, function(c){
                        return min;
                    });
                },
                func: function(s){
                    return buildInitDiceExpression(s);
                },
                desc: 'Sets the initiative to the lowest of all initiatives rolled for the group.'
            },
            'Mean-All-Roll':{
                mutator: function(l){
                    var mean = l[Math.round((l.length/2)-0.5)];
                    return _.times(l.length, function(c){
                        return mean;
                    });
                },
                func: function(s){
                    return buildInitDiceExpression(s);
                },
                desc: 'Sets the initiative to the mean (average) of all initiatives rolled for the group.'
            },
            'Individual-Roll': {
                mutator: function(l){
                    return l;
                },
                func: function(s){
                    return buildInitDiceExpression(s);
                },
                desc: 'Sets the initiative individually for each member of the group.'
            },
            'Constant-By-Stat': {
                mutator: function(l){
                    return l;
                },
                func: function(s){
                    return '0';
                },
                desc: 'Sets the initiative individually for each member of the group to their bonus with no roll.'
            }
        },

    checkInstall = function() {    
        log('-=> GroupInitiative v'+version+' <=-  ['+(new Date(lastUpdate*1000))+']');

        if( ! _.has(state,'GroupInitiative') || state.GroupInitiative.version !== schemaVersion) {
            log('  > Updating Schema to v'+schemaVersion+' <');
            switch(state.GroupInitiative && state.GroupInitiative.version) {
                case 0.5:
                    state.GroupInitiative.replaceRoll = false;
                    /* break; // intentional dropthrough */

                case 0.6:
                    state.GroupInitiative.config = {
                        rollType: state.GroupInitiative.rollType,
                        replaceRoll: state.GroupInitiative.replaceRoll,
                        dieSize: 20,
                        autoOpenInit: true,
                        sortOption: 'Descending'
                    };
                    delete state.GroupInitiative.replaceRoll;
                    delete state.GroupInitiative.rollType;
                    /* break; // intentional dropthrough */

                case 0.7:
                    state.GroupInitiative.config.announcer = 'Partial';
                    /* break; // intentional dropthrough */

                case 0.8:
                    state.GroupInitiative.config.diceCount = 1;
                    state.GroupInitiative.config.maxDecimal = 2;
                    /* break; // intentional dropthrough */
                    
                case 0.9:
                    state.GroupInitiative.config.diceCountAttribute = '';
                    /* break; // intentional dropthrough */

                case 0.10:
                    if(_.has(state.GroupInitiative.config,'dieCountAttribute')){
                        delete state.GroupInitiative.config.dieCountAttribute;
                        state.GroupInitiative.config.diceCountAttribute = '';
                    }
                    if(_.has(state.GroupInitiative.config,'dieCount')){
                        delete state.GroupInitiative.config.dieCount;
                        state.GroupInitiative.config.diceCount = 1;
                    }
                    /* break; // intentional dropthrough */

                case 'UpdateSchemaVersion':
                    state.GroupInitiative.version = schemaVersion;
                    break;

                default:
                    state.GroupInitiative = {
                        version: schemaVersion,
                        bonusStatGroups: [
                            [
                                {
                                    attribute: 'dexterity'
                                }
                            ]
                        ],
                        config: {
                            rollType: 'Individual-Roll',
                            replaceRoll: false,
                            dieSize: 20,
                            diceCount: 1,
                            maxDecimal: 2,
                            diceCountAttribute: '',
                            autoOpenInit: true,
                            sortOption: 'Descending',
                            announcer: 'Partial'
                        }
                    };
                    break;
            }
        }
    },

    ch = function (c) {
        var entities = {
            '<' : 'lt',
            '>' : 'gt',
            "'" : '#39',
            '@' : '#64',
            '{' : '#123',
            '|' : '#124',
            '}' : '#125',
            '[' : '#91',
            ']' : '#93',
            '"' : 'quot',
            '-' : 'mdash',
            ' ' : 'nbsp'
        };

        if(_.has(entities,c) ){
            return ('&'+entities[c]+';');
        }
        return '';
    },


    buildBonusStatGroupRows = function() {
        return _.reduce(state.GroupInitiative.bonusStatGroups, function(memo,bsg){
            return memo + '<li><span style="border: 1px solid #999;background-color:#eee;padding: 0px 3px;">'+_.chain(bsg)
            .map(function(s){
                var attr=s.attribute+'|'+( _.has(s,'type') ? s.type : 'current' );
                if(_.has(s,'adjustments')) {
                    attr=_.reduce(s.adjustments, function(memo2,a) {
                        return a+'( '+memo2+' )';
                    }, attr);
                }
                return attr;
            })
            .value()
            .join('</span> + <span style="border: 1px solid #999;background-color:#eee;padding: 0px 3px;">')
            +'</span></li>';
        },"");
    },

    buildStatAdjustmentRows = function() {
        return _.reduce(statAdjustments,function(memo,r,n){
            return memo+"<li><b>"+n+"</b> — "+r.desc+"</li>";
        },"");
    },

    getConfigOption_SortOptions = function() {
        var text = state.GroupInitiative.config.sortOption;
        return '<div>'+
            'Sort Options is currently <b>'+
                text+
            '</b>.'+
            '<div>'+
                _.map(_.keys(sorters),function(so){
                    return '<a href="!group-init-config --sort-option|'+so+'">'+
                        so+
                    '</a>';
                }).join(' ')+
            '</div>'+
        '</div>';
    },
    getConfigOption_DieSize = function() {
        return '<div>'
            +'Initiative Die size is currently <b>'
                +state.GroupInitiative.config.dieSize
            +'</b> '
            +'<a href="!group-init-config --set-die-size|?{Number of sides the initiative die has:|'+state.GroupInitiative.config.dieSize+'}">'
                +'Set Die Size'
            +'</a>'
        +'</div>';
    },

    getConfigOption_DiceCount = function() {
        return '<div>'
            +'Initiative Dice Count is currently <b>'
                +state.GroupInitiative.config.diceCount
            +'</b> '
            +'<a href="!group-init-config --set-dice-count|?{Number of initiative dice to roll:|'+state.GroupInitiative.config.diceCount+'}">'
                +'Set Dice Count'
            +'</a>'
        +'</div>';
    },

    getConfigOption_MaxDecimal = function() {
        return '<div>'
            +'Max decimal places <b>'
                +state.GroupInitiative.config.maxDecimal
            +'</b> '
            +'<a href="!group-init-config --set-max-decimal|?{Maximum number of decimal places:|'+state.GroupInitiative.config.maxDecimal+'}">'
                +'Set Max Decimal'
            +'</a>'
        +'</div>';
    },

    getConfigOption_DiceCountAttribute = function() {
        var text = (state.GroupInitiative.config.diceCountAttribute.length ? state.GroupInitiative.config.diceCountAttribute : 'DISABLED');
        return '<div>'
            +'Dice Count Attribute: <b>'
                +text
            +'</b> '
            +'<a href="!group-init-config --set-dice-count-attribute|?{Attribute to use for number of initiative dice to roll (Blank to disable):|'+state.GroupInitiative.config.diceCountAttribute+'}">'
                +'Set Attribute'
            +'</a>'
        +'</div>';
    },

    getConfigOption_AutoOpenInit = function() {
        var text = (state.GroupInitiative.config.autoOpenInit ? 'On' : 'Off' );
        return '<div>'
            +'Auto Open Init is currently <b>'
                +text
            +'</b> '
            +'<a href="!group-init-config --toggle-auto-open-init">'
                +'Toggle'
            +'</a>'
        +'</div>';
        
    },

    getConfigOption_ReplaceRoll = function() {
        var text = (state.GroupInitiative.config.replaceRoll ? 'On' : 'Off' );
        return '<div>'
            +'Replace Roll is currently <b>'
                +text
            +'</b> '
            +'<a href="!group-init-config --toggle-replace-roll">'
                +'Toggle'
            +'</a>'
            +'<p>Sets whether initative scores for selected tokens replace their current scores.</p>'
        +'</div>';
        
    },
    getConfigOption_RollerOptions = function() {
        var text = state.GroupInitiative.config.rollType;
        return '<div>'+
            'Roller is currently <b>'+
                text+
            '</b>.'+
            '<div>'+
                _.map(_.keys(rollers),function(r){
                    return '<a href="!group-init-config --set-roller|'+r+'">'+
                        r+
                    '</a>';
                }).join(' ')+
            '</div>'+
        '</div>';
    },
    getConfigOption_AnnounceOptions = function() {
        var text = state.GroupInitiative.config.announcer;
        return '<div>'+
            'Announcer is currently <b>'+
                text+
            '</b>.'+
            '<div>'+
                _.map(_.keys(announcers),function(an){
                    return '<a href="!group-init-config --set-announcer|'+an+'">'+
                        an+
                    '</a>';
                }).join(' ')+
            '</div>'+
        '</div>';
    },

    getAllConfigOptions = function() {
        return getConfigOption_RollerOptions() +
            getConfigOption_SortOptions() +
            getConfigOption_DieSize() +
            getConfigOption_DiceCount() +
            getConfigOption_DiceCountAttribute() +
            getConfigOption_MaxDecimal() +
            getConfigOption_AutoOpenInit() +
            getConfigOption_ReplaceRoll() +
            getConfigOption_AnnounceOptions();
    },

    showHelp = function() {
        var rollerRows=_.reduce(rollers,function(memo,r,n){
            var selected=((state.GroupInitiative.config.rollType === n) ? 
            '<div style="float:right;width:90px;border:1px solid black;background-color:#ffc;text-align:center;"><span style="color: red; font-weight:bold; padding: 0px 4px;">Selected</span></div>'
            : '' ),
            selectedStyleExtra=((state.GroupInitiative.config.rollType === n) ? ' style="border: 1px solid #aeaeae;background-color:#8bd87a;"' : '');

            return memo+selected+"<li "+selectedStyleExtra+"><b>"+n+"</b> - "+r.desc+"</li>";
        },""),
        statAdjustmentRows = buildStatAdjustmentRows(),
        bonusStatGroupRows = buildBonusStatGroupRows();            

        sendChat('',
            '/w gm '
            +'<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">'
            +'<div style="font-weight: bold; border-bottom: 1px solid black;font-size: 130%;">'
            +'GroupInitiative v'+version
            +'</div>'
            +'<div style="padding-left:10px;margin-bottom:3px;">'
            +'<p>Rolls initiative for the selected tokens and adds them '
            +'to the turn order if they don'+ch("'")+'t have a turn yet.</p>'

            +'<p>The calculation of initiative is handled by the '
            +'combination of Roller (See <b>Roller Options</b> below) and '
            +'a Bonus.  The Bonus is determined based on an ordered list '
            +'of Stat Groups (See <b>Bonus Stat Groups</b> below).  Stat '
            +'Groups are evaluated in order.  The bonus computed by the first '
            +'Stat Group for which all attributes exist and have a '
            +'numeric value is used.  This allows you to have several '
            +'Stat Groups that apply to different types of characters. '
            +'In practice you will probably only have one, but more are '
            +'there if you need them.</p>'
            +'</div>'
            +'<b>Commands</b>'
            +'<div style="padding-left:10px;">'
            +'<b><span style="font-family: serif;">!group-init</span></b>'
            +'<div style="padding-left: 10px;padding-right:20px">'
            +'<p>This command uses the configured Roller to '
            +'determine the initiative order for all selected '
            +'tokens.</p>'
            +'</div>'
            +'</div>'

            +'<div style="padding-left:10px;">'
            +'<b><span style="font-family: serif;">!group-init <i>--help</i></span></b>'
            +'<div style="padding-left: 10px;padding-right:20px">'
            +'<p>This command displays the help.</p>'
            +'</div>'
            +'</div>'

            +'<div style="padding-left:10px;">'
            +'<b><span style="font-family: serif;">!group-init <i>--promote</i> '+ch('<')+'index'+ch('>')+'</span></b>'
            +'<div style="padding-left: 10px;padding-right:20px">'
            +'<p>Increases the importance the specified Bonus Stat Group.</p>'
            +'This command requires 1 parameter:'
            +'<ul>'
            +'<li style="border-top: 1px solid #ccc;border-bottom: 1px solid #ccc;">'
            +'<b><span style="font-family: serif;">index</span></b> -- The numeric index of the Bonus Stat Group to promote.  See <b>Bonus Stat Groups</b> below.'
            +'</li> '
            +'</ul>'
            +'</div>'
            +'</div>'

            +'<div style="padding-left:10px;">'
            +'<b><span style="font-family: serif;">!group-init <i>--del-group</i> '+ch('<')+'index'+ch('>')+'</span></b>'
            +'<div style="padding-left: 10px;padding-right:20px">'
            +'<p>Deletes the specified Bonus Stat Group.</p>'
            +'This command requires 1 parameter:'
            +'<ul>'
            +'<li style="border-top: 1px solid #ccc;border-bottom: 1px solid #ccc;">'
            +'<b><span style="font-family: serif;">index</span></b> -- The numeric index of the Bonus Stat Group to delete.  See <b>Bonus Stat Groups</b> below.'
            +'</li> '
            +'</ul>'
            +'</div>'
            +'</div>'
            +'<div style="padding-left:10px;">'
            +'<b><span style="font-family: serif;">!group-init <i>--add-group</i> --'+ch('<')+'adjustment'+ch('>')+' [--'+ch('<')+'adjustment'+ch('>')+'] '+ch('<')+'attribute name[|'+ch('<')+'max|current'+ch('>')+']'+ch('>')+' [--'+ch('<')+'adjustment'+ch('>')+' [--'+ch('<')+'adjustment'+ch('>')+'] '+ch('<')+'attribute name[|'+ch('<')+'max|current'+ch('>')+']'+ch('>')+' ...]  </span></b>'
            +'<div style="padding-left: 10px;padding-right:20px">'
            +'<p>Adds a new Bonus Stat Group to the end of the list.  Each adjustment operation can be followed by another adjustment operation, but eventually must end in an attriute name.  Adjustment operations are applied to the result of the adjustment operations that follow them.</p>'
            +'<p>For example: <span style="border:1px solid #ccc; background-color: #eec; padding: 0px 3px;">--Bounded:-2:2 --Stat-DnD wisdom|max</span> would first computer the DnD Stat bonus for the max field of the wisdom attribute, then bound it between -2 and +2.</p>'
            +'This command takes multiple parameters:'
            +'<ul>'
            +'<li style="border-top: 1px solid #ccc;border-bottom: 1px solid #ccc;">'
            +'<b><span style="font-family: serif;">adjustment</span></b> -- One of the Stat Adjustment Options. See <b>Stat Adjustment Options</b> below.'
            +'</li> '
            +'<li style="border-top: 1px solid #ccc;border-bottom: 1px solid #ccc;">'
            +'<b><span style="font-family: serif;">attribute name</span></b> -- The name of an attribute.  You can specify |max or |current on the end to target those specific fields (defaults to |current).'
            +'</li> '
            +'</ul>'
            +'</div>'
            +'</div>'

            +'<div style="padding-left:10px;">'
            +'<b><span style="font-family: serif;">!group-init <i>--reroll</i></span></b>'
            +'<div style="padding-left: 10px;padding-right:20px">'
            +'<p>Rerolls all the tokens in the turn order as if they were selected when you executed the bare <b>!group-init</b> command.</p>'
            +'</div>'
            +'</div>'

            +'<b>Roller Options</b>'
            +'<div style="padding-left:10px;">'
            +'<ul>'
            +rollerRows
            +'</ul>'
            +'</div>'

            +'<b>Stat Adjustment Options</b>'
            +'<div style="padding-left:10px;">'
            +'<ul>'
            +statAdjustmentRows
            +'</ul>'
            +'</div>'

            +'<b>Bonus Stat Groups</b>'
            +'<div style="padding-left:10px;">'
            +'<ol>'
            +bonusStatGroupRows
            +'</ol>'
            +'</div>'

            +getAllConfigOptions()

            +'</div>'
        );
    },

    findInitiativeBonus = function(charObj,token) {
        var bonus = '';
        if(_.has(bonusCache,charObj.id)) {
            return bonusCache[charObj.id];
        }
        _.find(state.GroupInitiative.bonusStatGroups, function(group){
            bonus = _.chain(group)
                .map(function(details){
                    
                    var stat=getAttrByName(charObj.id,details.attribute, details.type||'current');
                    if( ! _.isUndefined(stat) && !_.isNull(stat) ) {
                        stat = (stat+'').replace(/@\{([^\|]*?|[^\|]*?\|max|[^\|]*?\|current)\}/g, '@{'+(charObj.get('name'))+'|$1}');
                        stat = _.reduce(details.adjustments || [],function(memo,a){
                            var args,adjustment,func;
                            if(memo) {
                                args=a.split(':');
                                adjustment=args.shift();
                                args.unshift(memo);
                                func=statAdjustments[adjustment].func;
                                if(_.isFunction(func)) {
                                    memo =func.apply({},args);
                                }
                            }
                            return memo;
                        },stat);
                        return stat;
                    }
                    return undefined;
                })
                .value();

            if(_.contains(bonus,undefined) || _.contains(bonus,null) || _.contains(bonus,NaN)) {
                bonus='';
                return false;
            }
            bonus = bonus.join('+');
            return true;
        });
        bonusCache[charObj.id]=bonus;
        return bonus;
    },

    handleInput = function(msg_orig) {
        var msg = _.clone(msg_orig),
            args,
            cmds,
            workgroup,
            workvar,
            turnorder,
            pageid=false,
            error=false,
            initFunc,
            rollSetup,
            initRolls,
            cont=false,
            manualBonus=0
			;

        if (msg.type !== "api" ) {
            return;
        }

        if(_.has(msg,'inlinerolls')){
        	msg.content = _.chain(msg.inlinerolls)
				.reduce(function(m,v,k){
					m['$[['+k+']]']=v.results.total || 0;
					return m;
				},{})
				.reduce(function(m,v,k){
					return m.replace(k,v);
				},msg.content)
				.value();
		}

        args = msg.content.split(/\s+--/);
        switch(args.shift()) {
            case '!group-init':
                if(args.length > 0) {
                    cmds=args.shift().split(/\s+/);

                    switch(cmds[0]) {
                        case 'help':
							if(!playerIsGM(msg.playerid)){
								return;
							}
                            showHelp();
                            break;

                        case 'add-group':
							if(!playerIsGM(msg.playerid)){
								return;
							}
                            workgroup=[];
                            workvar={};

                            _.each(args,function(arg){
                                var a=arg.split(/\s+(.+)/),
                                b,
                                c=a[0].split(/:/);

                                if(_.has(statAdjustments,c[0])) {
                                    if('Bare' !== c[0]) {
                                        if(!_.has(workvar,'adjustments')) {
                                            workvar.adjustments=[];
                                        }
                                        workvar.adjustments.unshift(a[0]);
                                    }
                                    if(a.length > 1){
                                        b=a[1].split(/\|/);
                                        workvar.attribute=b[0];
                                        if('max'===b[1]) {
                                            workvar.type = 'max';
                                        }
                                        workgroup.push(workvar);
                                        workvar={};
                                    }
                                } else {
                                    sendChat('!group-init --add-group', '/w gm ' 
                                        +'<div style="padding:1px 3px;border: 1px solid #8B4513;background: #eeffee; color: #8B4513; font-size: 80%;">'
                                        +'Unknown Stat Adjustment: '+c[0]+'<br>'
                                        +'Use one of the following:'
                                        +'<ul>'
                                        +buildStatAdjustmentRows()
                                        +'</ul>'
                                        +'</div>'
                                    );
                                    error=true;
                                }
                            });
                            if(!error) {
                                if(!_.has(workvar,'adjustments')){
                                    state.GroupInitiative.bonusStatGroups.push(workgroup);
                                    sendChat('GroupInitiative', '/w gm ' 
                                        +'<div style="padding:1px 3px;border: 1px solid #8B4513;background: #eeffee; color: #8B4513; font-size: 80%;">'
                                        +'Updated Bonus Stat Group Ordering:'
                                        +'<ol>'
                                        +buildBonusStatGroupRows()
                                        +'</ol>'
                                        +'</div>'
                                    );
                                } else {
                                    sendChat('!group-init --add-group', '/w gm ' 
                                        +'<div style="padding:1px 3px;border: 1px solid #8B4513;background: #eeffee; color: #8B4513; font-size: 80%;">'
                                        +'All Stat Adjustments must have a final attribute name as an argument.  Please add an attribute name after --'+args.pop()
                                        +'</div>'
                                    );
                                }
                            }
                            break;


                        case 'promote':
							if(!playerIsGM(msg.playerid)){
								return;
							}
                            cmds[1]=Math.max(parseInt(cmds[1],10),1);
                            if(state.GroupInitiative.bonusStatGroups.length >= cmds[1]) {
                                if(1 !== cmds[1]) {
                                    workvar=state.GroupInitiative.bonusStatGroups[cmds[1]-1];
                                    state.GroupInitiative.bonusStatGroups[cmds[1]-1] = state.GroupInitiative.bonusStatGroups[cmds[1]-2];
                                    state.GroupInitiative.bonusStatGroups[cmds[1]-2] = workvar;
                                }

                                sendChat('GroupInitiative', '/w gm ' 
                                    +'<div style="padding:1px 3px;border: 1px solid #8B4513;background: #eeffee; color: #8B4513; font-size: 80%;">'
                                    +'Updated Bonus Stat Group Ordering:'
                                    +'<ol>'
                                    +buildBonusStatGroupRows()
                                    +'</ol>'
                                    +'</div>'
                                );
                            } else {
                                sendChat('!group-init --promote', '/w gm ' 
                                    +'<div style="padding:1px 3px;border: 1px solid #8B4513;background: #eeffee; color: #8B4513; font-size: 80%;">'
                                    +'Please specify one of the following by number:'
                                    +'<ol>'
                                    +buildBonusStatGroupRows()
                                    +'</ol>'
                                    +'</div>'
                                );
                            }
                            break;

                        case 'del-group':
							if(!playerIsGM(msg.playerid)){
								return;
							}
                            cmds[1]=Math.max(parseInt(cmds[1],10),1);
                            if(state.GroupInitiative.bonusStatGroups.length >= cmds[1]) {
                                state.GroupInitiative.bonusStatGroups=_.filter(state.GroupInitiative.bonusStatGroups, function(v,k){
                                    return (k !== (cmds[1]-1));
                                });

                                sendChat('GroupInitiative', '/w gm ' 
                                    +'<div style="padding:1px 3px;border: 1px solid #8B4513;background: #eeffee; color: #8B4513; font-size: 80%;">'
                                    +'Updated Bonus Stat Group Ordering:'
                                    +'<ol>'
                                    +buildBonusStatGroupRows()
                                    +'</ol>'
                                    +'</div>'
                                );
                            } else {
                                sendChat('!group-init --del-group', '/w gm ' 
                                    +'<div style="padding:1px 3px;border: 1px solid #8B4513;background: #eeffee; color: #8B4513; font-size: 80%;">'
                                    +'Please specify one of the following by number:'
                                    +'<ol>'
                                    +buildBonusStatGroupRows()
                                    +'</ol>'
                                    +'</div>'
                                );
                            }
                            break;

						case 'reroll':
							msg.selected= _.chain(JSON.parse(Campaign().get('turnorder'))||[])
								.filter(function(e){
									return -1 !== e.id;
								})
								.map(function(e){
									return {_type: 'graphic', _id: e.id};
								})
								.value();
								cont=true;
							break;


                        case 'bonus':
                            if(cmds[1] && cmds[1].match(/^[\-\+]?\d+(\.\d+)?$/)){
                                manualBonus=parseFloat(cmds[1]);
                                cont=true;
                            } else {
                                sendChat('GroupInitiative', '/w gm ' 
                                    +'<div style="padding:1px 3px;border: 1px solid #8B4513;background: #eeffee; color: #8B4513; font-size: 80%;">'
                                    +'Not a valid bonus: <b>'+cmds[1]+'</b>'
                                    +'</div>'
                                );
                            }
                            break;

                        default:
							if(!playerIsGM(msg.playerid)){
								return;
							}
                            sendChat('GroupInitiative', '/w gm ' 
                                +'<div style="padding:1px 3px;border: 1px solid #8B4513;background: #eeffee; color: #8B4513; font-size: 80%;">'
                                +'Not a valid command: <b>'+cmds[0]+'</b>'
                                +'</div>'
                            );
                            break;
                    }
                } else {
                    cont=true;
                }

                if(cont) {
                    if(_.has(msg,'selected')) {
                        bonusCache = {};
                        turnorder = Campaign().get('turnorder');
                        turnorder = ('' === turnorder) ? [] : JSON.parse(turnorder);
                        if(state.GroupInitiative.config.replaceRoll) {
                            turnorder=_.reject(turnorder,function(i){
                                return _.contains(_.pluck(msg.selected, '_id'),i.id);
                            });
                        }

                        initFunc=rollers[state.GroupInitiative.config.rollType].func;

                        rollSetup = _.chain(msg.selected)
                            .map(function(s){
                                return getObj(s._type,s._id);
                            })
                            .reject(_.isUndefined)
                            .reject(function(s){
                                return _.contains(_.pluck(turnorder,'id'),s.id);
                            })
                            .map(function(s){
                                pageid=pageid || s.get('pageid');
                                return {
                                    token: s,
                                    character: getObj('character',s.get('represents'))
                                };
                            })
                            .map(function(s){
                                s.roll=[];
                                if(s.character) {
                                    s.roll.push( findInitiativeBonus(s.character,s.token) );
                                }
                                if(manualBonus) {
                                    s.roll.push( manualBonus );
                                }
                                s.roll.push( initFunc(s) );
                                return s;
                            })
                            .value();

                        initRolls = _.chain(rollSetup)
                            .pluck('roll')
                            .map(function(rs){
                                return _.reject(rs,function(r){
                                    return _.isString(r) && _.isEmpty(r);
                                });
                            })
                            .map(function(r){
                                return ('[[('+r.join(') + (')+')]]').replace(/\[\[\[/g, "[[ [");
                            })
                            .value()
                            .join('');

                        sendChat('',initRolls,function(msg){
                            var turnEntries=_.chain(msg[0].content.match(/\d+/g))
                                .map(function(idx){
                                    return msg[0].inlinerolls[idx];  
                                })
                                .map(function(ird,k){
                                    var rdata = {
                                        order: k,
                                        total: (ird.results.total%1===0
                                            ? ird.results.total 
                                            : parseFloat(ird.results.total.toFixed(state.GroupInitiative.config.maxDecimal))),
                                        rolls: _.reduce(ird.results.rolls,function(m,rs){
                                            if('R' === rs.type) {
                                                m.push({
                                                    sides: rs.sides,
                                                    rolls: _.pluck(rs.results,'v')
                                                });
                                            }
                                            return m;
                                        },[])
                                    };
                                    rdata.bonus = (ird.results.total - (_.reduce(rdata.rolls,function(m,r){
                                        m+=_.reduce(r.rolls,function(s,dieroll){
                                            return s+dieroll;
                                        },0);
                                        return m;
                                    },0)));

                                    rdata.bonus = (rdata.bonus%1===0
                                        ? rdata.bonus
                                        : parseFloat(rdata.bonus.toFixed(state.GroupInitiative.config.maxDecimal)));

                                    return rdata;
                                })
                                .sortBy('order')
                                .value();


                        turnEntries=rollers[state.GroupInitiative.config.rollType].mutator(turnEntries);

                        
                            Campaign().set({
                                turnorder: JSON.stringify(
                                    sorters[state.GroupInitiative.config.sortOption](
                                        turnorder.concat(
                                            _.chain(rollSetup)
                                                .map(function(s){
                                                    s.rollResults=turnEntries.shift();
                                                    return s;
                                                })
                                                .tap(announcers[state.GroupInitiative.config.announcer])
                                                .map(function(s){
                                                    return {
                                                        id: s.token.id,
                                                        pr: s.rollResults.total,
                                                        custom: ''
                                                    };
                                                })
                                                .value()
                                        )
                                    )
                                )
                            });
							notifyObservers('turnOrderChange');

                            if(state.GroupInitiative.config.autoOpenInit && !Campaign().get('initativepage')) {
                                Campaign().set({
                                    initiativepage: pageid
                                });
                            }
                        });
                    } else {
                        showHelp();
                    }
                }
                break;
            case '!group-init-config':
				if(!playerIsGM(msg.playerid)){
					return;
				}
                if(_.contains(args,'--help')) {
                    showHelp();
                    return;
                }
                if(!args.length) {
                    sendChat('','/w gm '
                        +'<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">'
                            +'<div style="font-weight: bold; border-bottom: 1px solid black;font-size: 130%;">'
                                +'GroupInitiative v'+version
                            +'</div>'
                            +getAllConfigOptions()
                        +'</div>'
                    );
                    return;
                }
                _.each(args,function(a){
                    var opt=a.split(/\|/),
                        omsg='';
                    switch(opt.shift()) {
                        case 'sort-option':
                            if(sorters[opt[0]]) {
                               state.GroupInitiative.config.sortOption=opt[0];
                            } else {
                                omsg='<div><b>Error:</b> Not a valid sort method: '+opt[0]+'</div>';
                            }
                            sendChat('','/w gm '
                                +'<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">'
                                    +omsg
                                    +getConfigOption_SortOptions()
                                +'</div>'
                            );
                            break;
                        case 'set-die-size':
                            if(opt[0].match(/^\d+$/)) {
                               state.GroupInitiative.config.dieSize=parseInt(opt[0],10);
                            } else {
                                omsg='<div><b>Error:</b> Not a die size: '+opt[0]+'</div>';
                            }
                            sendChat('','/w gm '
                                +'<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">'
                                    +omsg
                                    +getConfigOption_DieSize()
                                +'</div>'
                            );
                            break;

                        case 'set-max-decimal':
                            if(opt[0].match(/^\d+$/)) {
                               state.GroupInitiative.config.maxDecimal=parseInt(opt[0],10);
                            } else {
                                omsg='<div><b>Error:</b> Not a valid decimal count: '+opt[0]+'</div>';
                            }
                            sendChat('','/w gm '
                                +'<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">'
                                    +omsg
                                    +getConfigOption_MaxDecimal()
                                +'</div>'
                            );
                            break;


                        case 'set-dice-count':
                            if(opt[0].match(/^\d+$/)) {
                               state.GroupInitiative.config.diceCount=parseInt(opt[0],10);
                            } else {
                                omsg='<div><b>Error:</b> Not a valid dice count: '+opt[0]+'</div>';
                            }
                            sendChat('','/w gm '
                                +'<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">'
                                    +omsg
                                    +getConfigOption_DiceCount()
                                +'</div>'
                            );
                            break;

                        case 'set-dice-count-attribute':
                            if(opt[0]) {
                               state.GroupInitiative.config.diceCountAttribute=opt[0];
                            } else {
                                state.GroupInitiative.config.diceCountAttribute='';
                                omsg='<div>Cleared Dice Count Attribute.</div>';
                            }
                            sendChat('','/w gm '
                                +'<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">'
                                    +omsg
                                    +getConfigOption_DiceCountAttribute()
                                +'</div>'
                            );
                            break;

                        case 'toggle-auto-open-init':
                            state.GroupInitiative.config.autoOpenInit = !state.GroupInitiative.config.autoOpenInit;
                            sendChat('','/w gm '
                                +'<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">'
                                    +getConfigOption_AutoOpenInit()
                                +'</div>'
                            );
                            break;

                        case 'toggle-replace-roll':
                            state.GroupInitiative.config.replaceRoll = !state.GroupInitiative.config.replaceRoll;
                            sendChat('','/w gm '
                                +'<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">'
                                    +getConfigOption_ReplaceRoll()
                                +'</div>'
                            );
                            break;

                        case 'set-announcer':
                            if(announcers[opt[0]]) {
                               state.GroupInitiative.config.announcer=opt[0];
                            } else {
                                omsg='<div><b>Error:</b> Not a valid announcer: '+opt[0]+'</div>';
                            }
                            sendChat('','/w gm '
                                +'<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">'
                                    +omsg
                                    +getConfigOption_AnnounceOptions()
                                +'</div>'
                            );
                            break;

                        case 'set-roller':
                            if(rollers[opt[0]]) {
                               state.GroupInitiative.config.rollType=opt[0];
                            } else {
                                omsg='<div><b>Error:</b> Not a valid roller: '+opt[0]+'</div>';
                            }
                            sendChat('','/w gm '
                                +'<div style="border: 1px solid black; background-color: white; padding: 3px 3px;">'
                                    +omsg
                                    +getConfigOption_RollerOptions()
                                +'</div>'
                            );
                            break;

                        default:
                            sendChat('','/w gm '
                                +'<div><b>Unsupported Option:</div> '+a+'</div>'
                            );
                    }
                            
                });

                break;
        }

    },


    registerEventHandlers = function() {
        on('chat:message', handleInput);
    };

    return {
        RegisterEventHandlers: registerEventHandlers,
		ObserveTurnOrderChange: observeTurnOrderChange,
        CheckInstall: checkInstall
    };
}());

on("ready",function(){
    'use strict';

        GroupInitiative.CheckInstall();
        GroupInitiative.RegisterEventHandlers();
});

