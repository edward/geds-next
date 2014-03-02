(function($) {
    var queryParser = function(a) {
        var i, p, b = {};
        if (a === "") {
            return {};
        }
        for (i = 0; i < a.length; i += 1) {
            p = a[i].split('=');
            if (p.length === 2) {
                b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
            }
        }
        return b;
    };
    $.queryParams = function() {
        return queryParser(window.location.search.substr(1).split('&'));
    };
    $.hashParams = function() {
        return queryParser(window.location.hash.substr(1).split('&'));
    };


    var ident = 0;

    window.Swiftype = window.Swiftype || {};
    Swiftype.root_url = Swiftype.root_url || 'https://api.swiftype.com';
    Swiftype.pingUrl = function(endpoint, callback) {
        var to = setTimeout(callback, 350);
        var img = new Image();
        img.onload = img.onerror = function() {
            clearTimeout(to);
            callback();
        };
        img.src = endpoint;
        return false;
    };
    Swiftype.pingAutoSelection = function(engineKey, docId, value, callback) {
        var params = {
            t: new Date().getTime(),
            engine_key: engineKey,
            doc_id: docId,
            prefix: value
        };
        var url = Swiftype.root_url + '/api/v1/public/analytics/pas?' + $.param(params);
        Swiftype.pingUrl(url, callback);
    };
    Swiftype.findSelectedSection = function() {
        var sectionText = $.hashParams().sts;
        if (!sectionText) {
            return;
        }

        function normalizeText(str) {
            var out = str.replace(/\s+/g, '');
            out = out.toLowerCase();
            return out;
        }

        sectionText = normalizeText(sectionText);

        $('h1, h2, h3, h4, h5, h6').each(function(idx) {
            $this = $(this);
            if (normalizeText($this.text()).indexOf(sectionText) >= 0) {
                this.scrollIntoView(true);
                return false;
            }
        });
    };

    Swiftype.htmlEscape = Swiftype.htmlEscape || function htmlEscape(str) {
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    $.fn.swiftype = function(options) {
        Swiftype.findSelectedSection();
        var options = $.extend({}, $.fn.swiftype.defaults, options);

        return this.each(function() {
            var $this = $(this);
            var config = $.meta ? $.extend({}, options, $this.data()) : options;
            $this.attr('autocomplete', 'off');
            $this.data('swiftype-config-autocomplete', config);
            $this.submitted = false;
            $this.cache = new LRUCache(10);
            $this.emptyQueries = [];

            $this.isEmpty = function(query) {
                return $.inArray(normalize(query), this.emptyQueries) >= 0
            };

            $this.addEmpty = function(query) {
                $this.emptyQueries.unshift(normalize(query));
            };

            var styles = config.dropdownStylesFunction($this);
            var $swiftypeWidget = $('<div class="swiftype-widget" />');
            var $listContainer = $('<div />').addClass(config.suggestionListClass).appendTo($swiftypeWidget).css(styles).hide();
            $swiftypeWidget.appendTo(config.autocompleteContainingElement);
            var $list = $('<' + config.suggestionListType + ' />').appendTo($listContainer);

            $this.data('swiftype-list', $list);

            $this.abortCurrent = function() {
                if ($this.currentRequest) {
                    $this.currentRequest.abort();
                }
            };

            $this.showList = function() {
                if (handleFunctionParam(config.disableAutocomplete) === false) {
                    $listContainer.show();
                }
            };


            $this.hideList = function(sync) {
                if (sync) {
                    $listContainer.hide();
                } else {
                    setTimeout(function() {
                        $listContainer.hide();
                    }, 10);
                }
            };

            $this.focused = function() {
                return $this.is(':focus');
            };

            $this.submitting = function() {
                $this.submitted = true;
            };

            $this.listResults = function() {
                return $(config.resultListSelector, $list);
            };

            $this.activeResult = function() {
                return $this.listResults().filter('.' + config.activeItemClass).first();
            };

            $this.prevResult = function() {
                var list = $this.listResults(),
                    currentIdx = list.index($this.activeResult()),
                    nextIdx = currentIdx - 1,
                    next = list.eq(nextIdx);
                $this.listResults().removeClass(config.activeItemClass);
                if (nextIdx >= 0) {
                    next.addClass(config.activeItemClass);
                }
            };

            $this.nextResult = function() {
                var list = $this.listResults(),
                    currentIdx = list.index($this.activeResult()),
                    nextIdx = currentIdx + 1,
                    next = list.eq(nextIdx);
                $this.listResults().removeClass(config.activeItemClass);
                if (nextIdx >= 0) {
                    next.addClass(config.activeItemClass);
                }
            };

            $this.selectedCallback = function(data) {
                // debugger
                return function() {
                    var value = $this.val(),
                        callback = function() {
                            config.onComplete(data, value);
                        };
                    Swiftype.pingAutoSelection(config.engineKey, data['id'], value, callback);
                };
            };

            $this.registerResult = function($element, data) {
                $element.data('swiftype-item', data);
                $element.click($this.selectedCallback(data)).mouseover(function() {
                    $this.listResults().removeClass(config.activeItemClass);
                    $element.addClass(config.activeItemClass);
                });
            };

            $this.getContext = function() {
                return {
                    config: config,
                    list: $list,
                    registerResult: $this.registerResult
                };
            };


            var typingDelayPointer;
            var suppressKey = false;
            $this.lastValue = '';
            $this.keyup(function(event) {
                if (suppressKey) {
                    suppressKey = false;
                    return;
                }

                // ignore arrow keys, shift
                if (((event.which > 36) && (event.which < 41)) || (event.which == 16)) return;

                if (config.typingDelay > 0) {
                    clearTimeout(typingDelayPointer);
                    typingDelayPointer = setTimeout(function() {
                        processInput($this);
                    }, config.typingDelay);
                } else {
                    processInput($this);
                }
            });

            $this.styleDropdown = function() {
                $listContainer.css(config.dropdownStylesFunction($this));
            };

            $this.keydown(function(event) {
                $this.styleDropdown();
                // enter = 13; up = 38; down = 40; esc = 27
                var $active = $this.activeResult();
                switch (event.which) {
                    case 13:
                        if (($active.length !== 0) && ($list.is(':visible'))) {
                            event.preventDefault();
                            $this.selectedCallback($active.data('swiftype-item'))();
                        } else if ($this.currentRequest) {
                            $this.submitting();
                        }
                        $this.hideList();
                        suppressKey = true;
                        break;
                    case 38:
                        event.preventDefault();
                        if ($active.length === 0) {
                            $this.listResults().last().addClass(config.activeItemClass);
                        } else {
                            $this.prevResult();
                        }
                        break;
                    case 40:
                        event.preventDefault();
                        if ($active.length === 0) {
                            $this.listResults().first().addClass(config.activeItemClass);
                        } else if ($active != $this.listResults().last()) {
                            $this.nextResult();
                        }
                        break;
                    case 27:
                        $this.hideList();
                        suppressKey = true;
                        break;
                    default:
                        $this.submitted = false;
                        break;
                }
            });

            // opera wants keypress rather than keydown to prevent the form submit
            $this.keypress(function(event) {
                if ((event.which == 13) && ($this.activeResult().length > 0)) {
                    event.preventDefault();
                }
            });

            // stupid hack to get around loss of focus on mousedown
            var mouseDown = false;
            var blurWait = false;
            $(document).bind('mousedown.swiftype' + ++ident, function() {
                mouseDown = true;
            });
            $(document).bind('mouseup.swiftype' + ident, function() {
                mouseDown = false;
                if (blurWait) {
                    blurWait = false;
                    $this.hideList();
                }
            });
            $this.blur(function() {
                if (mouseDown) {
                    blurWait = true;
                } else {
                    $this.hideList();
                }
            });
            $this.focus(function() {
                setTimeout(function() {
                    $this.select()
                }, 10);
                if ($this.listResults().filter(':not(.' + config.noResultsClass + ')').length > 0) {
                    $this.showList();
                }
            });
        });
    };

    var normalize = function(str) {
        return $.trim(str).toLowerCase();
    };

    var callRemote = function($this, term) {
        $this.abortCurrent();

        var params = {},
            config = $this.data('swiftype-config-autocomplete');

        params['q'] = term;
        params['engine_key'] = config.engineKey;
        params['search_fields'] = handleFunctionParam(config.searchFields);
        params['fetch_fields'] = handleFunctionParam(config.fetchFields);
        params['filters'] = handleFunctionParam(config.filters);
        params['document_types'] = handleFunctionParam(config.documentTypes);
        params['functional_boosts'] = handleFunctionParam(config.functionalBoosts);
        params['sort_field'] = handleFunctionParam(config.sortField);
        params['sort_direction'] = handleFunctionParam(config.sortDirection);
        params['per_page'] = config.resultLimit;

        var endpoint = Swiftype.root_url + '/api/v1/public/engines/suggest.json';
        $this.currentRequest = $.ajax({
            type: 'GET',
            dataType: 'jsonp',
            url: endpoint,
            data: params
        }).success(function(data) {
            var norm = normalize(term);
            if (data.record_count > 0) {
                $this.cache.put(norm, data.records);
            } else {
                $this.addEmpty(norm);
                $this.data('swiftype-list').empty();
                $this.hideList();
                return;
            }
            processData($this, data.records, term);
        });

        // data = JSON.parse("{\"record_count\":10,\"records\":{\"people\":[{\"Department Name (EN)\":\"Natural Resources Canada\",\"Title (EN)\":\"Environmental Scientist\",\"Title (FR)\":\"Chercheur en environnement\",\"Province (FR)\":\"Ontario\",\"Executive Assistant\":\"\",\"Street Address (FR)\":\"588, rue Booth, 3e tage, pice: 350B\",\"Prefix (FR)\":\"\",\"Room\":\"\",\"Fax Number\":\"\",\"Telephone Number\":\"(613) 947-1279\",\"TDD Number\":\"\",\"City (EN)\":\"Ottawa\",\"GivenName\":\"Alice\",\"PO Box (FR)\":\"\",\"PO Box (EN)\":\"\",\"Street Address (EN)\":\"588 Booth Street, 3rd Floor, Room: 350B\",\"external_id\":\"38723\",\"Suffix (FR)\":\"\",\"Secure Fax Number\":\"\",\"Country (EN)\":\"Canada\",\"Suffix (EN)\":\"\",\"Postal Code\":\"K1A 0Y7\",\"Prefix (EN)\":\"\",\"Floor\":\"\",\"Mailstop\":\"\",\"Department Acronym\":\"NRCAN-RNCAN\",\"Executive Assistant Telephone Number\":\"\",\"updated_at\":\"2014-03-02T01:23:28Z\",\"Alternate Telephone Number\":\"\",\"Email\":\"Alice.Deschamps@NRCan-RNCan.gc.ca\",\"Secure Telephone Number\":\"\",\"Administrative Assistant\":\"\",\"City (FR)\":\"Ottawa\",\"Administrative Assistant Telephone Number\":\"\",\"Initials\":\"\",\"Province (EN)\":\"Ontario\",\"Building (FR)\":\"\",\"Building (EN)\":\"\",\"Department Name (FR)\":\"Ressources naturelles Canada\",\"Surname\":\"Deschamps\",\"Country (FR)\":\"Canada\",\"id\":\"5312881014cc8aac4f010f74\",\"_score\":5.5638523,\"_type\":\"531244a1eaa0b281070000da\",\"_index\":\"531244a1eaa0b281070000db\",\"_version\":null,\"sort\":null,\"highlight\":{\"GivenName\":\"<em>Alice</em>\",\"Email\":\"<em>Alice.Deschamps</em>@NRCan-RNCan.gc.ca\"},\"_explanation\":null},{\"Department Name (EN)\":\"Environment Canada\",\"Title (EN)\":\"Environmental Scientist\",\"Title (FR)\":\"Spcialiste de l'environnement\",\"Province (FR)\":\"Ontario\",\"Executive Assistant\":\"\",\"Street Address (FR)\":\"867 Lakeshore Rd\",\"Prefix (FR)\":\"\",\"Room\":\"\",\"Fax Number\":\"\",\"Telephone Number\":\"(905) 336-4449\",\"TDD Number\":\"\",\"City (EN)\":\"Burlington\",\"GivenName\":\"Alice\",\"PO Box (FR)\":\"\",\"PO Box (EN)\":\"\",\"Street Address (EN)\":\"867 Lakeshore Rd\",\"external_id\":\"42218\",\"Suffix (FR)\":\"\",\"Secure Fax Number\":\"\",\"Country (EN)\":\"Canada\",\"Suffix (EN)\":\"\",\"Postal Code\":\"L7R 4A6\",\"Prefix (EN)\":\"\",\"Floor\":\"\",\"Mailstop\":\"\",\"Department Acronym\":\"EC-EC\",\"Executive Assistant Telephone Number\":\"\",\"updated_at\":\"2014-03-02T01:25:07Z\",\"Alternate Telephone Number\":\"\",\"Email\":\"\",\"Secure Telephone Number\":\"\",\"Administrative Assistant\":\"\",\"City (FR)\":\"Burlington\",\"Administrative Assistant Telephone Number\":\"\",\"Initials\":\"\",\"Province (EN)\":\"Ontario\",\"Building (FR)\":\"\",\"Building (EN)\":\"\",\"Department Name (FR)\":\"Environnement Canada\",\"Surname\":\"Dove\",\"Country (FR)\":\"Canada\",\"id\":\"5312887314cc8a5581010465\",\"_score\":5.5638523,\"_type\":\"531244a1eaa0b281070000da\",\"_index\":\"531244a1eaa0b281070000db\",\"_version\":null,\"sort\":null,\"highlight\":{\"GivenName\":\"<em>Alice</em>\"},\"_explanation\":null},{\"Department Name (EN)\":\"Environment Canada\",\"Title (EN)\":\"Environmental Scientist\",\"Title (FR)\":\"Scientifique en environnement\",\"Province (FR)\":\"Qubec\",\"Executive Assistant\":\"\",\"Street Address (FR)\":\"105, rue McGill\",\"Prefix (FR)\":\"\",\"Room\":\"\",\"Fax Number\":\"(905) 336-4609\",\"Telephone Number\":\"(905) 336-4449\",\"TDD Number\":\"\",\"City (EN)\":\"Montral\",\"GivenName\":\"Alice\",\"PO Box (FR)\":\"\",\"PO Box (EN)\":\"\",\"Street Address (EN)\":\"105, rue McGill\",\"external_id\":\"42217\",\"Suffix (FR)\":\"\",\"Secure Fax Number\":\"\",\"Country (EN)\":\"Canada\",\"Suffix (EN)\":\"\",\"Postal Code\":\"H2Y 2E7\",\"Prefix (EN)\":\"\",\"Floor\":\"\",\"Mailstop\":\"\",\"Department Acronym\":\"EC-EC\",\"Executive Assistant Telephone Number\":\"\",\"updated_at\":\"2014-03-02T01:25:07Z\",\"Alternate Telephone Number\":\"\",\"Email\":\"\",\"Secure Telephone Number\":\"\",\"Administrative Assistant\":\"\",\"City (FR)\":\"Montral\",\"Administrative Assistant Telephone Number\":\"\",\"Initials\":\"\",\"Province (EN)\":\"Quebec\",\"Building (FR)\":\"\",\"Building (EN)\":\"\",\"Department Name (FR)\":\"Environnement Canada\",\"Surname\":\"Dove\",\"Country (FR)\":\"Canada\",\"id\":\"53128873eaa0b21d0d0009b4\",\"_score\":5.5638523,\"_type\":\"531244a1eaa0b281070000da\",\"_index\":\"531244a1eaa0b281070000db\",\"_version\":null,\"sort\":null,\"highlight\":{\"GivenName\":\"<em>Alice</em>\"},\"_explanation\":null},{\"Department Name (EN)\":\"Fisheries and Oceans Canada\",\"Title (EN)\":\"A/Chief of Business Management Services\",\"Title (FR)\":\"Chef des services de gestion d'affaires p.i.\",\"Province (FR)\":\"Nouvelle-cosse\",\"Executive Assistant\":\"\",\"Street Address (FR)\":\"215, rue Main\",\"Prefix (FR)\":\"\",\"Room\":\"\",\"Fax Number\":\"\",\"Telephone Number\":\"902-742-0875\",\"TDD Number\":\"\",\"City (EN)\":\"Yarmouth\",\"GivenName\":\"Alice\",\"PO Box (FR)\":\"\",\"PO Box (EN)\":\"\",\"Street Address (EN)\":\"215 Main Street\",\"external_id\":\"38364\",\"Suffix (FR)\":\"\",\"Secure Fax Number\":\"\",\"Country (EN)\":\"Canada\",\"Suffix (EN)\":\"\",\"Postal Code\":\"B5A 1C6\",\"Prefix (EN)\":\"\",\"Floor\":\"\",\"Mailstop\":\"\",\"Department Acronym\":\"DFO-MPO\",\"Executive Assistant Telephone Number\":\"\",\"updated_at\":\"2014-03-02T01:23:19Z\",\"Alternate Telephone Number\":\"\",\"Email\":\"\",\"Secure Telephone Number\":\"\",\"Administrative Assistant\":\"\",\"City (FR)\":\"Yarmouth\",\"Administrative Assistant Telephone Number\":\"\",\"Initials\":\"\",\"Province (EN)\":\"Nova Scotia\",\"Building (FR)\":\"\",\"Building (EN)\":\"\",\"Department Name (FR)\":\"Pches et Ocans Canada\",\"Surname\":\"d'Entremont\",\"Country (FR)\":\"Canada\",\"id\":\"53128807eaa0b273b3010cf6\",\"_score\":5.5638523,\"_type\":\"531244a1eaa0b281070000da\",\"_index\":\"531244a1eaa0b281070000db\",\"_version\":null,\"sort\":null,\"highlight\":{\"GivenName\":\"<em>Alice</em>\"},\"_explanation\":null},{\"Department Name (EN)\":\"Commissioner of Official Languages, Office of the\",\"Title (EN)\":\"Policy Analyst\",\"Title (FR)\":\"Analyste des politiques\",\"Province (FR)\":\"Ontario\",\"Executive Assistant\":\"\",\"Street Address (FR)\":\"344, rue Slater, 4e tage\",\"Prefix (FR)\":\"\",\"Room\":\"\",\"Fax Number\":\"(613) 995-1161\",\"Telephone Number\":\"(613) 943-9994\",\"TDD Number\":\"\",\"City (EN)\":\"Ottawa\",\"GivenName\":\"Alice\",\"PO Box (FR)\":\"\",\"PO Box (EN)\":\"\",\"Street Address (EN)\":\"344 Slater Street, 4th Floor\",\"external_id\":\"56076\",\"Suffix (FR)\":\"\",\"Secure Fax Number\":\"\",\"Country (EN)\":\"Canada\",\"Suffix (EN)\":\"\",\"Postal Code\":\"K1A 0T8\",\"Prefix (EN)\":\"\",\"Floor\":\"\",\"Mailstop\":\"\",\"Department Acronym\":\"OCOL-COLO\",\"Executive Assistant Telephone Number\":\"\",\"updated_at\":\"2014-03-02T01:31:36Z\",\"Alternate Telephone Number\":\"\",\"Email\":\"\",\"Secure Telephone Number\":\"\",\"Administrative Assistant\":\"\",\"City (FR)\":\"Ottawa\",\"Administrative Assistant Telephone Number\":\"\",\"Initials\":\"\",\"Province (EN)\":\"Ontario\",\"Building (FR)\":\"\",\"Building (EN)\":\"\",\"Department Name (FR)\":\"Commissariat aux langues officielles\",\"Surname\":\"Gheorghiu\",\"Country (FR)\":\"Canada\",\"id\":\"531289f8eaa0b2d242000b1b\",\"_score\":5.5638523,\"_type\":\"531244a1eaa0b281070000da\",\"_index\":\"531244a1eaa0b281070000db\",\"_version\":null,\"sort\":null,\"highlight\":{\"GivenName\":\"<em>Alice</em>\"},\"_explanation\":null},{\"Department Name (EN)\":\"Veterans Affairs Canada\",\"Title (EN)\":\"Programmer\",\"Title (FR)\":\"Programmeuse\",\"Province (FR)\":\"le-du-Prince-douard\",\"Executive Assistant\":\"\",\"Street Address (FR)\":\"3, chemin Lower Malpeque\",\"Prefix (FR)\":\"\",\"Room\":\"\",\"Fax Number\":\"(902) 566-8056\",\"Telephone Number\":\"(902) 566-6934\",\"TDD Number\":\"\",\"City (EN)\":\"Charlottetown\",\"GivenName\":\"Alice\",\"PO Box (FR)\":\"\",\"PO Box (EN)\":\"\",\"Street Address (EN)\":\"3 Lower Malpeque Road\",\"external_id\":\"53403\",\"Suffix (FR)\":\"\",\"Secure Fax Number\":\"\",\"Country (EN)\":\"Canada\",\"Suffix (EN)\":\"\",\"Postal Code\":\"C1A 8M9\",\"Prefix (EN)\":\"\",\"Floor\":\"\",\"Mailstop\":\"\",\"Department Acronym\":\"VAC-ACC\",\"Executive Assistant Telephone Number\":\"\",\"updated_at\":\"2014-03-02T01:30:23Z\",\"Alternate Telephone Number\":\"\",\"Email\":\"\",\"Secure Telephone Number\":\"\",\"Administrative Assistant\":\"\",\"City (FR)\":\"Charlottetown\",\"Administrative Assistant Telephone Number\":\"\",\"Initials\":\"\",\"Province (EN)\":\"Prince Edward Island\",\"Building (FR)\":\"\",\"Building (EN)\":\"\",\"Department Name (FR)\":\"Anciens Combattants Canada\",\"Surname\":\"Gallant\",\"Country (FR)\":\"Canada\",\"id\":\"531289afc9f929a4b7013195\",\"_score\":5.5638523,\"_type\":\"531244a1eaa0b281070000da\",\"_index\":\"531244a1eaa0b281070000db\",\"_version\":null,\"sort\":null,\"highlight\":{\"GivenName\":\"<em>Alice</em>\"},\"_explanation\":null},{\"Department Name (EN)\":\"House of Commons\",\"Title (EN)\":\"Advisor\",\"Title (FR)\":\"Conseillre\",\"Province (FR)\":\"Ontario\",\"Executive Assistant\":\"\",\"Street Address (FR)\":\"131 rue Queen\",\"Prefix (FR)\":\"\",\"Room\":\"\",\"Fax Number\":\"(613) 992-2599\",\"Telephone Number\":\"(613) 947-7051\",\"TDD Number\":\"\",\"City (EN)\":\"Ottawa\",\"GivenName\":\"Alice\",\"PO Box (FR)\":\"\",\"PO Box (EN)\":\"\",\"Street Address (EN)\":\"131 Queen Street\",\"external_id\":\"50854\",\"Suffix (FR)\":\"\",\"Secure Fax Number\":\"\",\"Country (EN)\":\"Canada\",\"Suffix (EN)\":\"\",\"Postal Code\":\"K1A 0A6\",\"Prefix (EN)\":\"\",\"Floor\":\"\",\"Mailstop\":\"\",\"Department Acronym\":\"HoC-CdC\",\"Executive Assistant Telephone Number\":\"\",\"updated_at\":\"2014-03-02T01:29:13Z\",\"Alternate Telephone Number\":\"\",\"Email\":\"alice.fortunato@parl.gc.ca\",\"Secure Telephone Number\":\"\",\"Administrative Assistant\":\"\",\"City (FR)\":\"Ottawa\",\"Administrative Assistant Telephone Number\":\"\",\"Initials\":\"\",\"Province (EN)\":\"Ontario\",\"Building (FR)\":\"\",\"Building (EN)\":\"\",\"Department Name (FR)\":\"Chambre des communes\",\"Surname\":\"Fortunato\",\"Country (FR)\":\"Canada\",\"id\":\"53128969eaa0b21d0d000ac0\",\"_score\":5.5638523,\"_type\":\"531244a1eaa0b281070000da\",\"_index\":\"531244a1eaa0b281070000db\",\"_version\":null,\"sort\":null,\"highlight\":{\"GivenName\":\"<em>Alice</em>\",\"Email\":\"<em>alice.fortunato</em>@parl.gc.ca\"},\"_explanation\":null},{\"Department Name (EN)\":\"Public Works and Government Services Canada\",\"Title (EN)\":\"Student\",\"Title (FR)\":\"tudiante\",\"Province (FR)\":\"Qubec\",\"Executive Assistant\":\"\",\"Street Address (FR)\":\"11, rue Laurier\",\"Prefix (FR)\":\"\",\"Room\":\"\",\"Fax Number\":\"(819) 956-6705\",\"Telephone Number\":\"(819) 956-5698\",\"TDD Number\":\"\",\"City (EN)\":\"Gatineau\",\"GivenName\":\"Alice\",\"PO Box (FR)\":\"\",\"PO Box (EN)\":\"\",\"Street Address (EN)\":\"11 Laurier Street\",\"external_id\":\"54222\",\"Suffix (FR)\":\"\",\"Secure Fax Number\":\"\",\"Country (EN)\":\"Canada\",\"Suffix (EN)\":\"\",\"Postal Code\":\"K1A 0S5\",\"Prefix (EN)\":\"\",\"Floor\":\"\",\"Mailstop\":\"\",\"Department Acronym\":\"PWGSC-TPSGC\",\"Executive Assistant Telephone Number\":\"\",\"updated_at\":\"2014-03-02T01:30:44Z\",\"Alternate Telephone Number\":\"\",\"Email\":\"alice.gasirabo@tpsgc-pwgsc.gc.ca\",\"Secure Telephone Number\":\"\",\"Administrative Assistant\":\"\",\"City (FR)\":\"Gatineau\",\"Administrative Assistant Telephone Number\":\"\",\"Initials\":\"\",\"Province (EN)\":\"Quebec\",\"Building (FR)\":\"\",\"Building (EN)\":\"\",\"Department Name (FR)\":\"Travaux publics et Services gouvernementaux Canada\",\"Surname\":\"Gasirabo\",\"Country (FR)\":\"Canada\",\"id\":\"531289c4c9f92993a1000c01\",\"_score\":5.5638523,\"_type\":\"531244a1eaa0b281070000da\",\"_index\":\"531244a1eaa0b281070000db\",\"_version\":null,\"sort\":null,\"highlight\":{\"GivenName\":\"<em>Alice</em>\",\"Email\":\"<em>alice.gasirabo</em>@tpsgc-pwgsc.gc.ca\"},\"_explanation\":null},{\"Department Name (EN)\":\"Public Works and Government Services Canada\",\"Title (EN)\":\"Team Leader\",\"Title (FR)\":\"Chef d'quipe\",\"Province (FR)\":\"Nouveau-Brunswick\",\"Executive Assistant\":\"\",\"Street Address (FR)\":\"10, rue Weldon\",\"Prefix (FR)\":\"\",\"Room\":\"\",\"Fax Number\":\"\",\"Telephone Number\":\"(506) 533-5522\",\"TDD Number\":\"\",\"City (EN)\":\"Shediac\",\"GivenName\":\"Alice\",\"PO Box (FR)\":\"\",\"PO Box (EN)\":\"\",\"Street Address (EN)\":\"10 Weldon Street\",\"external_id\":\"55068\",\"Suffix (FR)\":\"\",\"Secure Fax Number\":\"\",\"Country (EN)\":\"Canada\",\"Suffix (EN)\":\"\",\"Postal Code\":\"E4P 2X7\",\"Prefix (EN)\":\"\",\"Floor\":\"\",\"Mailstop\":\"\",\"Department Acronym\":\"PWGSC-TPSGC\",\"Executive Assistant Telephone Number\":\"\",\"updated_at\":\"2014-03-02T01:31:10Z\",\"Alternate Telephone Number\":\"\",\"Email\":\"alice.gauvin-cormier@pwgsc-tpsgc.gc.ca\",\"Secure Telephone Number\":\"\",\"Administrative Assistant\":\"\",\"City (FR)\":\"Shediac\",\"Administrative Assistant Telephone Number\":\"\",\"Initials\":\"\",\"Province (EN)\":\"New Brunswick\",\"Building (FR)\":\"\",\"Building (EN)\":\"\",\"Department Name (FR)\":\"Travaux publics et Services gouvernementaux Canada\",\"Surname\":\"Gauvin-Cormier\",\"Country (FR)\":\"Canada\",\"id\":\"531289deeaa0b2b43100f218\",\"_score\":5.5638523,\"_type\":\"531244a1eaa0b281070000da\",\"_index\":\"531244a1eaa0b281070000db\",\"_version\":null,\"sort\":null,\"highlight\":{\"GivenName\":\"<em>Alice</em>\",\"Email\":\"<em>alice.gauvin</em>-cormier@pwgsc-tpsgc.gc.ca\"},\"_explanation\":null},{\"Department Name (EN)\":\"Fisheries and Oceans Canada\",\"Title (EN)\":\"Administrative Assistant\",\"Title (FR)\":\"Adjointe administrative\",\"Province (FR)\":\"Nouveau-Brunswick\",\"Executive Assistant\":\"\",\"Street Address (FR)\":\"Centre des pches du Golfe  343, avenue de l'Universit\",\"Prefix (FR)\":\"\",\"Room\":\"\",\"Fax Number\":\"(506) 851-2079\",\"Telephone Number\":\"(506) 851-2328\",\"TDD Number\":\"\",\"City (EN)\":\"Moncton\",\"GivenName\":\"Alice\",\"PO Box (FR)\":\"\",\"PO Box (EN)\":\"\",\"Street Address (EN)\":\"Gulf Fisheries Centre  343 Universit Avenue\",\"external_id\":\"58832\",\"Suffix (FR)\":\"\",\"Secure Fax Number\":\"\",\"Country (EN)\":\"Canada\",\"Suffix (EN)\":\"\",\"Postal Code\":\"E1C 9B6\",\"Prefix (EN)\":\"\",\"Floor\":\"\",\"Mailstop\":\"\",\"Department Acronym\":\"DFO-MPO\",\"Executive Assistant Telephone Number\":\"\",\"updated_at\":\"2014-03-02T01:32:50Z\",\"Alternate Telephone Number\":\"\",\"Email\":\"\",\"Secure Telephone Number\":\"\",\"Administrative Assistant\":\"\",\"City (FR)\":\"Moncton\",\"Administrative Assistant Telephone Number\":\"\",\"Initials\":\"\",\"Province (EN)\":\"New Brunswick\",\"Building (FR)\":\"\",\"Building (EN)\":\"\",\"Department Name (FR)\":\"Pches et Ocans Canada\",\"Surname\":\"Gould\",\"Country (FR)\":\"Canada\",\"id\":\"53128a42eaa0b235d601106e\",\"_score\":5.5638523,\"_type\":\"531244a1eaa0b281070000da\",\"_index\":\"531244a1eaa0b281070000db\",\"_version\":null,\"sort\":null,\"highlight\":{\"GivenName\":\"<em>Alice</em>\"},\"_explanation\":null}]},\"info\":{\"people\":{\"query\":\"alice\",\"current_page\":1,\"num_pages\":9,\"per_page\":10,\"total_result_count\":89}},\"errors\":{}}")
        // 
        // var norm = normalize(term);
        // if (data.record_count > 0) {
        //     $this.cache.put(norm, data.records);
        // } else {
        //     $this.addEmpty(norm);
        //     $this.data('swiftype-list').empty();
        //     $this.hideList();
        //     return;
        // }
        // processData($this, data.records, term);
    };

    var getResults = function($this, term) {
        var norm = normalize(term);
        if ($this.isEmpty(norm)) {
            $this.data('swiftype-list').empty();
            $this.hideList();
            return;
        }
        var cached = $this.cache.get(norm);
        if (cached) {
            processData($this, cached, term);
        } else {
            callRemote($this, term);
        }
    };

    // private helpers
    var processInput = function($this) {
        var term = $this.val();
        if (term === $this.lastValue) {
            return;
        }
        $this.lastValue = term;
        if ($.trim(term) === '') {
            $this.data('swiftype-list').empty()
            $this.hideList();
            return;
        }
        if (typeof $this.data('swiftype-config-autocomplete').engineKey !== 'undefined') {
            getResults($this, term);
        }
    };

    var processData = function($this, data, term) {
        var $list = $this.data('swiftype-list'),
            config = $this.data('swiftype-config-autocomplete');

        $list.empty();
        $this.hideList(true);

        config.resultRenderFunction($this.getContext(), data);

        var totalItems = $this.listResults().length;
        if ((totalItems > 0 && $this.focused()) || (config.noResultsMessage !== undefined)) {
            if ($this.submitted) {
                $this.submitted = false;
            } else {
                $this.showList();
            }
        }
    };

    var defaultResultRenderFunction = function(ctx, results) {
        var $list = ctx.list,
            config = ctx.config;

        $.each(results, function(document_type, items) {
            $.each(items, function(idx, item) {
                ctx.registerResult($('<li>' + config.renderFunction(document_type, item) + '</li>').appendTo($list), item);
            });
        });
    };

    var defaultRenderFunction = function(document_type, item) {
        // BUG
        // Not all data comes back with a “title” column
        return '<p class="title">' + Swiftype.htmlEscape(item['title']) + '</p>';
    };

    var defaultOnComplete = function(item, prefix) {
        window.location = item['url'];
    };

    var defaultDropdownStylesFunction = function($this) {
        var config = $this.data('swiftype-config-autocomplete');
        var $attachEl = config.attachTo ? $(config.attachTo) : $this;
        var offset = $attachEl.offset();
        var styles = {
            'position': 'absolute',
            'z-index': 9999,
            'top': offset.top + $attachEl.outerHeight() + 1,
            'left': offset.left
        };
        if (config.setWidth) {
            styles['width'] = $attachEl.outerWidth() - 2;
        }
        return styles;
    };

    var handleFunctionParam = function(field) {
        if (field !== undefined) {
            var evald = field;
            if (typeof evald === 'function') {
                evald = evald.call();
            }
            return evald;
        }
        return undefined;
    };

    // simple client-side LRU Cache, based on https://github.com/rsms/js-lru

    function LRUCache(limit) {
        this.size = 0;
        this.limit = limit;
        this._keymap = {};
    }

    LRUCache.prototype.put = function(key, value) {
        var entry = {
            key: key,
            value: value
        };
        this._keymap[key] = entry;
        if (this.tail) {
            this.tail.newer = entry;
            entry.older = this.tail;
        } else {
            this.head = entry;
        }
        this.tail = entry;
        if (this.size === this.limit) {
            return this.shift();
        } else {
            this.size++;
        }
    };

    LRUCache.prototype.shift = function() {
        var entry = this.head;
        if (entry) {
            if (this.head.newer) {
                this.head = this.head.newer;
                this.head.older = undefined;
            } else {
                this.head = undefined;
            }
            entry.newer = entry.older = undefined;
            delete this._keymap[entry.key];
        }
        return entry;
    };

    LRUCache.prototype.get = function(key, returnEntry) {
        var entry = this._keymap[key];
        if (entry === undefined) return;
        if (entry === this.tail) {
            return entry.value;
        }
        if (entry.newer) {
            if (entry === this.head) this.head = entry.newer;
            entry.newer.older = entry.older;
        }
        if (entry.older) entry.older.newer = entry.newer;
        entry.newer = undefined;
        entry.older = this.tail;
        if (this.tail) this.tail.newer = entry;
        this.tail = entry;
        return returnEntry ? entry : entry.value;
    };

    LRUCache.prototype.remove = function(key) {
        var entry = this._keymap[key];
        if (!entry) return;
        delete this._keymap[entry.key];
        if (entry.newer && entry.older) {
            entry.older.newer = entry.newer;
            entry.newer.older = entry.older;
        } else if (entry.newer) {
            entry.newer.older = undefined;
            this.head = entry.newer;
        } else if (entry.older) {
            entry.older.newer = undefined;
            this.tail = entry.older;
        } else {
            this.head = this.tail = undefined;
        }

        this.size--;
        return entry.value;
    };

    LRUCache.prototype.clear = function() {
        this.head = this.tail = undefined;
        this.size = 0;
        this._keymap = {};
    };

    if (typeof Object.keys === 'function') {
        LRUCache.prototype.keys = function() {
            return Object.keys(this._keymap);
        };
    } else {
        LRUCache.prototype.keys = function() {
            var keys = [];
            for (var k in this._keymap) keys.push(k);
            return keys;
        };
    }

    $.fn.swiftype.defaults = {
        activeItemClass: 'active',
        attachTo: undefined,
        documentTypes: undefined,
        filters: undefined,
        engineKey: undefined,
        searchFields: undefined,
        functionalBoosts: undefined,
        sortField: undefined,
        sortDirection: undefined,
        fetchFields: undefined,
        noResultsClass: 'noResults',
        noResultsMessage: undefined,
        onComplete: defaultOnComplete,
        resultRenderFunction: defaultResultRenderFunction,
        renderFunction: defaultRenderFunction,
        dropdownStylesFunction: defaultDropdownStylesFunction,
        resultLimit: undefined,
        suggestionListType: 'ul',
        suggestionListClass: 'autocomplete',
        resultListSelector: 'li',
        setWidth: true,
        typingDelay: 80,
        disableAutocomplete: false,
        autocompleteContainingElement: 'body'
    };

})(jQuery);