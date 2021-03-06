<?php

	if (defined('APP_VERSION'))
	{
		if (!defined('APP_REQUEST_RND'))
		{
			if (function_exists('sys_getloadavg')) {
				$load = sys_getloadavg();
				if ($load[0] > 95) {
					header('HTTP/1.1 503 Service Unavailable');
					header('Retry-After: 120');
					exit('Mailserver too busy. Please try again later.');
				}
				unset($load);
			}

			ini_set('register_globals', 0);
			ini_set('zend.ze1_compatibility_mode', 0);

			define('APP_REQUEST_RND', function_exists('uuid_create') ? md5(uuid_create(UUID_TYPE_DEFAULT)) : bin2hex(random_bytes(16)));
			define('APP_VERSION_ROOT_PATH', APP_INDEX_ROOT_PATH.'snappymail/v/'.APP_VERSION.'/');

			define('APP_USE_APC_CACHE', true);

			// "img-src https:" is allowed due to remote images in e-mails
			define('APP_DEFAULT_CSP', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https: http:; style-src 'self' 'unsafe-inline'");

			date_default_timezone_set('UTC');

			$sSite = strtolower(trim(empty($_SERVER['HTTP_HOST']) ? (empty($_SERVER['SERVER_NAME']) ? '' : $_SERVER['SERVER_NAME']) : $_SERVER['HTTP_HOST']));
			$sSite = 'www.' === substr($sSite, 0, 4) ? substr($sSite, 4) : $sSite;
			$sSite = preg_replace('/^.+@/', '', preg_replace('/:[\d]+$/', '', $sSite));
			$sSite = in_array($sSite, array('localhost', '127.0.0.1', '::1', '::1/128', '0:0:0:0:0:0:0:1')) ? 'localhost' : trim($sSite);
			$sSite = 0 === strlen($sSite) ? 'localhost' : $sSite;

			define('APP_SITE', $sSite);
			unset($sSite);

			define('APP_DEFAULT_PRIVATE_DATA_NAME', '_default_');

			$sPrivateDataFolderInternalName = defined('MULTIDOMAIN') ? APP_SITE : '';
			define('APP_PRIVATE_DATA_NAME', 0 === strlen($sPrivateDataFolderInternalName) ? APP_DEFAULT_PRIVATE_DATA_NAME : $sPrivateDataFolderInternalName);
			define('APP_MULTIPLY', 0 < strlen($sPrivateDataFolderInternalName) && APP_DEFAULT_PRIVATE_DATA_NAME !== APP_PRIVATE_DATA_NAME);

			define('APP_DUMMY', '********');
			define('APP_DEV_VERSION', '0.0.0');

			$sCustomDataPath = '';
			$sCustomConfiguration = '';

			if (is_file(APP_INDEX_ROOT_PATH.'include.php'))
			{
				include_once APP_INDEX_ROOT_PATH.'include.php';
			}

			$sCustomDataPath = function_exists('__get_custom_data_full_path') ? rtrim(trim(__get_custom_data_full_path()), '\\/') : $sCustomDataPath;
			define('APP_DATA_FOLDER_PATH', 0 === strlen($sCustomDataPath) ? APP_INDEX_ROOT_PATH.'data/' : $sCustomDataPath.'/');
			unset($sCustomDataPath);

			$sCustomConfiguration = function_exists('__get_additional_configuration_name') ? trim(__get_additional_configuration_name()) : $sCustomConfiguration;
			define('APP_ADDITIONAL_CONFIGURATION_NAME', $sCustomConfiguration);
			unset($sCustomConfiguration);

			define('APP_DATA_FOLDER_PATH_UNIX', str_replace('\\', '/', APP_DATA_FOLDER_PATH));

			$sSalt = is_file(APP_DATA_FOLDER_PATH.'SALT.php') ? file_get_contents(APP_DATA_FOLDER_PATH.'SALT.php') : '';
			$sData = is_file(APP_DATA_FOLDER_PATH.'DATA.php') ? file_get_contents(APP_DATA_FOLDER_PATH.'DATA.php') : '';
			$sInstalled = is_file(APP_DATA_FOLDER_PATH.'INSTALLED') ? file_get_contents(APP_DATA_FOLDER_PATH.'INSTALLED') : '';

			// installation checking data folder
			if (APP_VERSION !== $sInstalled)
			{
				include APP_VERSION_ROOT_PATH.'check.php';

				$sCheckName = 'delete_if_you_see_it_after_install';
				$sCheckFolder = APP_DATA_FOLDER_PATH.$sCheckName;
				$sCheckFilePath = APP_DATA_FOLDER_PATH.$sCheckName.'/'.$sCheckName.'.file';

				is_file($sCheckFilePath) && unlink($sCheckFilePath);
				is_dir($sCheckFolder) && rmdir($sCheckFolder);

				if (!is_dir(APP_DATA_FOLDER_PATH))
				{
					mkdir(APP_DATA_FOLDER_PATH, 0700);
				}
				else
				{
					chmod(APP_DATA_FOLDER_PATH, 0700);
				}

				$sTest = '';
				switch (true)
				{
					case !is_dir(APP_DATA_FOLDER_PATH):
						$sTest = 'is_dir';
						break;
					case !is_readable(APP_DATA_FOLDER_PATH):
						$sTest = 'is_readable';
						break;
					case !is_writable(APP_DATA_FOLDER_PATH):
						$sTest = 'is_writable';
						break;
					case !mkdir($sCheckFolder, 0700):
						$sTest = 'mkdir';
						break;
					case false === file_put_contents($sCheckFilePath, time()):
						$sTest = 'file_put_contents';
						break;
					case !unlink($sCheckFilePath):
						$sTest = 'unlink';
						break;
					case !rmdir($sCheckFolder):
						$sTest = 'rmdir';
						break;
				}

				if (!empty($sTest))
				{
					echo '[202] Data folder permissions error ['.$sTest.']';
					exit(202);
				}

				unset($sCheckName, $sCheckFilePath, $sCheckFolder, $sTest);
			}

			if (false === $sSalt)
			{
				// random salt
				file_put_contents(APP_DATA_FOLDER_PATH.'SALT.php', '<'.'?php //'.bin2hex(random_bytes(48)));
			}

			define('APP_SALT', md5($sSalt.APP_PRIVATE_DATA_NAME.$sSalt));
			define('APP_PRIVATE_DATA', APP_DATA_FOLDER_PATH.'_data_'.($sData ? md5($sData) : '').'/'.APP_PRIVATE_DATA_NAME.'/');

			define('APP_PLUGINS_PATH', APP_PRIVATE_DATA.'plugins/');

			if (APP_VERSION !== $sInstalled || (APP_MULTIPLY && !is_dir(APP_PRIVATE_DATA)))
			{
				define('APP_INSTALLED_START', true);
				define('APP_INSTALLED_VERSION', $sInstalled);

				file_put_contents(APP_DATA_FOLDER_PATH.'INSTALLED', APP_VERSION);
				file_put_contents(APP_DATA_FOLDER_PATH.'VERSION', APP_VERSION);
				file_put_contents(APP_DATA_FOLDER_PATH.'index.html', 'Forbidden');
				file_put_contents(APP_DATA_FOLDER_PATH.'index.php', 'Forbidden');

				if (!is_file(APP_DATA_FOLDER_PATH.'.htaccess') && is_file(APP_VERSION_ROOT_PATH.'app/.htaccess'))
				{
					copy(APP_VERSION_ROOT_PATH.'app/.htaccess', APP_DATA_FOLDER_PATH.'.htaccess');
				}

				if (!is_dir(APP_PRIVATE_DATA))
				{
					mkdir(APP_PRIVATE_DATA, 0755, true);
				}

				foreach (array('logs', 'cache', 'configs', 'plugins', 'storage') as $sName)
				{
					if (!is_dir(APP_PRIVATE_DATA.$sName))
					{
						mkdir(APP_PRIVATE_DATA.$sName, 0755, true);
					}
				}

				if (!file_exists(APP_PRIVATE_DATA.'domains/disabled'))
				{
					if (!is_dir(APP_PRIVATE_DATA.'domains'))
					{
						mkdir(APP_PRIVATE_DATA.'domains', 0755);
					}

					if (is_dir(APP_PRIVATE_DATA.'domains'))
					{
						$sFile = $sNewFile = $sNewFileName = '';
						$aFiles = glob(APP_VERSION_ROOT_PATH.'app/domains/*');

						if (is_array($aFiles) && 0 < \count($aFiles))
						{
							foreach ($aFiles as $sFile)
							{
								if (is_file($sFile))
								{
									$sNewFileName = basename($sFile);
									if ('default.ini.dist' !== $sNewFileName)
									{
										$sNewFile = APP_PRIVATE_DATA.'domains/'.$sNewFileName;
										if (!file_exists($sNewFile))
										{
											copy($sFile, $sNewFile);
										}
									}
								}
							}
						}

//						$sClearedSiteName = preg_replace('/^(www|demo|snappymail|webmail|email|mail|imap|imap4|smtp)\./i', '', trim(APP_SITE));
//						if (!empty($sClearedSiteName) && file_exists(APP_VERSION_ROOT_PATH.'app/domains/default.ini.dist') &&
//							!file_exists(APP_PRIVATE_DATA.'domains/'.$sClearedSiteName.'.ini'))
//						{
//							$sConfigTemplate = file_get_contents(APP_VERSION_ROOT_PATH.'app/domains/default.ini.dist');
//							if (!empty($sConfigTemplate))
//							{
//								file_put_contents(APP_PRIVATE_DATA.'domains/'.$sClearedSiteName.'.ini', strtr($sConfigTemplate, array(
//									'IMAP_HOST' => 'localhost' !== $sClearedSiteName? 'imap.'.$sClearedSiteName : $sClearedSiteName,
//									'IMAP_PORT' => '993',
//									'SMTP_HOST' => 'localhost' !== $sClearedSiteName? 'smtp.'.$sClearedSiteName : $sClearedSiteName,
//									'SMTP_PORT' => '465'
//								)));
//							}
//
//							unset($sConfigTemplate);
//						}

						unset($aFiles, $sFile, $sNewFileName, $sNewFile);
					}
				}
			}

			unset($sSalt, $sData, $sInstalled, $sPrivateDataFolderInternalName);
		}

		// See https://github.com/kjdev/php-ext-brotli
		if (defined('USE_GZIP') && !ini_get('zlib.output_compression') && !ini_get('brotli.output_compression')) {
			ob_start('ob_gzhandler');
		}

		include APP_VERSION_ROOT_PATH.'app/handle.php';

		if (defined('SNAPPYMAIL_EXIT_ON_END') && SNAPPYMAIL_EXIT_ON_END)
		{
			exit(0);
		}
	}
